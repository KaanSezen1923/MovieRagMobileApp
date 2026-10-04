import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView, Modal, RefreshControl } from 'react-native';
import { Send, Menu, Film, Mic, Square, Bell, BellOff, X, Trash2, ChevronRight, CheckCheck, Sparkles, Clock, MessageSquare } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from '../api/client';
import { normalizeMovie } from '../utils/normalization';
import MovieCard from './Card';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  date?: string;
  timestamp?: string;
  is_read: boolean;
  data?: any;
  movie?: any;
}

const formatNotificationDate = (dateStr?: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Bugün ${time}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return `Dün ${time}`;
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
};

const Chat = ({ navigation, sessionId, messages, setMessages, fetchSessions, onShowRecommendations }: any) => {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const pollInterval = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const audioOptions = { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true };
  const audioRecorder = useAudioRecorder(audioOptions);
  const [isRecording, setIsRecording] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [refreshingNotifications, setRefreshingNotifications] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(['Bilim kurgu filmi öner', 'Nolan filmi öner', 'Tim Burton filmi öner']);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Bildirimleri yerel hafızadan (SecureStore) yükle
  useEffect(() => {
    const loadStoredNotifications = async () => {
      try {
        const stored = await SecureStore.getItemAsync('user_notifications');
        if (stored) {
          setNotifications(JSON.parse(stored));
        }
      } catch (e) {
        console.error("Bildirimler yüklenemedi:", e);
      }
    };
    loadStoredNotifications();
    fetchNotifications(true);
  }, []);

  // Bildirimleri kaydetme yardımcısı
  const saveNotifications = async (updated: NotificationItem[]) => {
    setNotifications(updated);
    try {
      await SecureStore.setItemAsync('user_notifications', JSON.stringify(updated));
    } catch (e) {
      console.error("Bildirim kaydedilemedi:", e);
    }
  };

  // Backend'deki /recommendations uç noktasından bildirimleri çek ve yerel verilerle senkronize et
  const fetchNotifications = async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) setNotificationsLoading(true);
    try {
      const res = await api.get('/recommendations');
      const apiList = Array.isArray(res.data) ? res.data : [];

      setNotifications((prev) => {
        const prevMap = new Map<string, any>();
        prev.forEach((n) => {
          if (n.id) prevMap.set(String(n.id), n);
          if (n.title) prevMap.set(String(n.title).toLowerCase().trim(), n);
          if (n.movie?.Film) prevMap.set(String(n.movie.Film).toLowerCase().trim(), n);
          if (n.movie?.title) prevMap.set(String(n.movie.title).toLowerCase().trim(), n);
          if (n.data?.movie_title) prevMap.set(String(n.data.movie_title).toLowerCase().trim(), n);
        });

        const merged: NotificationItem[] = apiList.map((item: any) => {
          const itemTitle = String(item.title || '').toLowerCase().trim();
          const matchedPrev = prevMap.get(String(item.id)) || 
                              prevMap.get(itemTitle) || 
                              (item.movie_id ? prevMap.get(String(item.movie_id)) : null);
          return {
            id: String(item.id),
            title: item.title,
            body: item.body || item.message || '',
            date: item.date,
            is_read: Boolean(item.is_read),
            data: item.data || matchedPrev?.data || (item.movie_id ? { movie_id: item.movie_id } : null),
            movie: item.movie || matchedPrev?.movie || null,
          };
        });

        // Backend'de henüz listelenmeyen anlık push bildirimlerini de koru
        const apiIds = new Set(apiList.map((i: any) => String(i.id)));
        const apiTitles = new Set(apiList.map((i: any) => String(i.title).toLowerCase().trim()));
        const extraLocal = prev.filter(
          (p) => !apiIds.has(String(p.id)) && !apiTitles.has(String(p.title).toLowerCase().trim())
        );

        const finalList = [...merged, ...extraLocal];
        SecureStore.setItemAsync('user_notifications', JSON.stringify(finalList)).catch(() => {});
        return finalList;
      });
    } catch (e) {
      console.error("Bildirimler sunucudan çekilemedi:", e);
    } finally {
      if (showLoadingSpinner) setNotificationsLoading(false);
      setRefreshingNotifications(false);
    }
  };

  // Tüm bildirimleri okundu olarak işaretle (Backend + Local)
  const handleMarkAllAsRead = async () => {
    try {
      await api.patch('/recommendations/read');
    } catch (e) {
      console.error("Okundu işaretleme hatası:", e);
    }
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, is_read: true }));
      SecureStore.setItemAsync('user_notifications', JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  };

  // Push bildirimi dinleyicileri ve token kaydı
  useEffect(() => {
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch (e) { }

    const registerPushToken = async () => {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus === 'granted') {
          const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
          if (tokenData?.data) {
            await api.post('/update-push-token', { token: tokenData.data }).catch(() => {});
          }
        }
      } catch (e) { }
    };
    registerPushToken();

    const addNotificationFromPush = (notif: any) => {
      const notifData: any = notif.request?.content?.data;
      const notifTitle = notif.request?.content?.title;
      const notifBody = notif.request?.content?.body || '';
      
      const newNotif: NotificationItem = {
        id: notif.request?.identifier || String(Date.now()),
        title: notifData?.movies?.[0]?.Film || notifTitle || '🎬 Yeni Öneri',
        body: notifBody,
        data: notifData || null,
        movie: notifData?.movies?.[0] || null,
        date: new Date().toISOString(),
        is_read: false,
      };

      setNotifications((prev) => {
        const updated = [newNotif, ...prev.filter((n) => n.id !== newNotif.id)];
        SecureStore.setItemAsync('user_notifications', JSON.stringify(updated)).catch(() => {});
        return updated;
      });
      fetchNotifications();
    };

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      addNotificationFromPush(notification);
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const notifData: any = response.notification?.request?.content?.data;
      const notifTitle = response.notification?.request?.content?.title;
      const notifBody = response.notification?.request?.content?.body || '';

      const newNotif: NotificationItem = {
        id: response.notification?.request?.identifier || String(Date.now()),
        title: notifData?.movies?.[0]?.Film || notifTitle || '🎬 Yeni Öneri',
        body: notifBody,
        data: notifData || null,
        movie: notifData?.movies?.[0] || null,
        date: new Date().toISOString(),
        is_read: true,
      };

      handleNotificationPress(newNotif);
      fetchNotifications();
    });

    return () => {
      receivedSub?.remove?.();
      responseSub?.remove?.();
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, []);

  const handleClearNotifications = async () => {
    try {
      await api.patch('/recommendations/read').catch(() => {});
    } catch (e) { }
    await saveNotifications([]);
  };

  const handleDeleteNotification = async (id: string) => {
    const updated = notifications.filter((n) => String(n.id) !== String(id));
    await saveNotifications(updated);
  };

  const handleNotificationPress = (notif: NotificationItem) => {
    setShowNotifications(false);

    // Bildirimi tekil olarak okundu yap
    if (!notif.is_read) {
      setNotifications((prev) => {
        const updated = prev.map((n) => (String(n.id) === String(notif.id) ? { ...n, is_read: true } : n));
        SecureStore.setItemAsync('user_notifications', JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    }

    let targetRawMovie = null;
    if (Array.isArray(notif.data?.movies) && notif.data.movies.length > 0) {
      if (notif.data.movie_title) {
        const targetTitle = String(notif.data.movie_title).toLowerCase();
        targetRawMovie = notif.data.movies.find((m: any) => 
          (m.Film || m.title || '').toLowerCase() === targetTitle
        ) || notif.data.movies[0];
      } else {
        targetRawMovie = notif.data.movies[0];
      }
    } else if (notif.movie) {
      targetRawMovie = notif.movie;
    } else if (notif.data?.movie) {
      targetRawMovie = notif.data.movie;
    } else if (notif.data?.movie_title) {
      targetRawMovie = {
        ...notif.data,
        title: notif.data.movie_title,
        overview: notif.data?.overview || '',
        recommendationNote: notif.body,
        isPartial: true,
      };
    } else if (notif.title && notif.title !== '🎬 Yeni Bildirim' && notif.title !== 'Senin İçin Bir Film Buldum 🍿') {
      targetRawMovie = {
        id: notif.data?.movie_id || notif.title,
        title: notif.title,
        overview: '',
        recommendationNote: notif.body,
        isPartial: true,
      };
    }

    if (targetRawMovie) {
      const movie = normalizeMovie(targetRawMovie);
      if (targetRawMovie.recommendationNote) {
        movie.recommendationNote = targetRawMovie.recommendationNote;
      }
      navigation.navigate('MovieDetail', { movie, savedIds: favoriteIds, onToggle: fetchFavoriteIds });
    } else if (notif.body) {
      handleSend(notif.body);
    }
  };

  // Bildirimdeki film hakkında yapay zekaya doğrudan soru sorma
  const handleAskAboutMovie = (notif: NotificationItem) => {
    setShowNotifications(false);
    if (!notif.is_read) {
      setNotifications((prev) => {
        const updated = prev.map((n) => (String(n.id) === String(notif.id) ? { ...n, is_read: true } : n));
        SecureStore.setItemAsync('user_notifications', JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    }

    const movieTitle = notif.title && notif.title !== '🎬 Yeni Bildirim' && notif.title !== 'Senin İçin Bir Film Buldum 🍿'
      ? notif.title
      : notif.data?.movies?.[0]?.Film || notif.movie?.Film || '';

    if (movieTitle) {
      handleSend(`"${movieTitle}" filmi hakkında detaylı bilgi ver ve bana bu filmi neden önerdiğini açıkla.`);
    } else if (notif.body) {
      handleSend(notif.body);
    }
  };

  const openNotificationModal = () => {
    setShowNotifications(true);
    fetchNotifications();
  };

  const fetchSuggestions = async () => {
    try {
      const res = await api.get(`/chat/suggestions`);
      if (res.data?.suggestions) setSuggestions(res.data.suggestions);
    } catch (e) { }
  };

  const fetchFavoriteIds = async () => {
    try {
      const res = await api.get(`/favorites/ids`);
      setFavoriteIds(res.data.favorite_ids || []);
    } catch (e) { }
  };

  useEffect(() => {
    fetchSuggestions();
    fetchFavoriteIds();
    fetchNotifications();
  }, [sessionId]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await api.get(`/chat/${sessionId}`);
        const history = res.data.history.map((m: any) => {
          let finalContent = m.content;
          let extractedMovies = [];
          if (typeof m.content === 'string' && (m.content.startsWith('{') || m.content.startsWith('['))) {
            try {
              const parsed = JSON.parse(m.content);
              if (parsed.type === "movie_list") {
                finalContent = parsed.text;
                extractedMovies = parsed.movies;
              }
            } catch (e) { }
          }
          return { role: m.role, content: finalContent, movies: m.movies || extractedMovies };
        });
        setMessages(history);
      } catch (e) { setMessages([]); }
    };
    loadHistory();
  }, [sessionId]);

  const startRecording = async () => {
    try {
      let permissionGranted = true;
      if (AudioModule?.requestRecordingPermissionsAsync) {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        permissionGranted = permission.status === 'granted';
      }
      if (!permissionGranted) {
        Alert.alert("İzin Gerekli", "Sesli komut için mikrofon izni vermeniz gerekiyor.");
        return;
      }
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
    } catch (err) { }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) return;
      handleAudioTranscription(uri);
    } catch (err) { }
  };

  const handleAudioTranscription = async (uri: string) => {
    setLoading(true);
    const filename = uri.split('/').pop() || 'recording.m4a';
    try {
      const rawToken = await SecureStore.getItemAsync('user_token');
      const authHeader = rawToken ? (rawToken.startsWith('Bearer ') ? rawToken : `Bearer ${rawToken}`) : '';

      const headers: Record<string, string> = {
        'Accept': 'application/json',
      };
      if (authHeader) {
        headers['Authorization'] = authHeader;
      }

      const response = await FileSystem.uploadAsync(`${api.defaults.baseURL}/transcribe`, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'audio',
        mimeType: 'audio/m4a',
        headers,
      });

      if (response.status === 200) {
        const data = JSON.parse(response.body);
        if (data.success && data.text) {
          setInput(data.text);
        } else {
          console.error("Transcription API error:", data);
        }
      } else {
        console.error("Transcription HTTP error:", response.status, response.body);
      }
    } catch (error: any) { 
      console.error("Transcription error:", error);
    } finally { setLoading(false); }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (pollInterval.current) {
      clearInterval(pollInterval.current);
      pollInterval.current = null;
    }
    setLoading(false);
    setStatusMessage('');
    setMessages((prev: any) => [
      ...prev,
      { role: 'assistant', content: '⏹️ Yanıt oluşturma durduruldu.' }
    ]);
  };

  const handleSend = async (textToSend?: any) => {
    const queryText = (typeof textToSend === 'string' ? textToSend : '') || input;
    if (!queryText.trim() || loading) return;

    setMessages((prev: any) => [...prev, { role: 'user', content: queryText }]);
    setInput('');
    setLoading(true);
    setStatusMessage('🔍 Sorgu analiz ediliyor...');
    const startTime = Date.now();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    pollInterval.current = setInterval(async () => {
      try {
        const res = await api.get(`/chat/status/${sessionId}`);
        if (res.data?.status) setStatusMessage(res.data.status);
      } catch (err) { }
    }, 500);

    try {
      const res = await api.post(`/chat`, { session_id: sessionId, prompt: queryText }, {
        signal: controller.signal,
      });
      const endTime = Date.now();
      const responseTime = ((endTime - startTime) / 1000).toFixed(2);

      let finalContent = res.data.answer;
      let extractedMovies = [];
      try {
        const parsed = typeof res.data.answer === 'string' ? JSON.parse(res.data.answer) : res.data.answer;
        if (parsed.type === "movie_list") {
          finalContent = parsed.text;
          extractedMovies = parsed.movies;
        }
      } catch { }

      setMessages((prev: any) => [...prev, { role: 'assistant', content: finalContent + `\n\n⏱️ Yanıt Süresi: ${responseTime} saniye`, movies: extractedMovies }]);
      fetchSessions();
      fetchSuggestions();
      // Arka planda generate_and_save_recommendation_task çalıştığı için kısa bir süre sonra bildirimleri senkronize et
      setTimeout(() => {
        fetchNotifications();
      }, 3500);
    } catch (e: any) {
      if (controller.signal.aborted || e?.name === 'CanceledError' || e?.name === 'AbortError' || e?.code === 'ERR_CANCELED') {
        return;
      }
      console.error("Chat gönderim hatası:", e?.response?.data || e.message || e);
      const errMsg = e?.response?.data?.detail || "Bir hata oluştu.";
      setMessages((prev: any) => [...prev, { role: 'assistant', content: typeof errMsg === 'string' ? errMsg : "Bir hata oluştu." }]);
    } finally {
      if (pollInterval.current) clearInterval(pollInterval.current);
      abortControllerRef.current = null;
      setLoading(false);
      setStatusMessage('');
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    if (item.role === 'assistant_loading') {
      return (
        <View style={[styles.msgBox, styles.botMsg, styles.loadingMsgBox]}>
          <ActivityIndicator color="#E50914" size="small" style={{ marginRight: 8 }} />
          <Text style={styles.loadingText}>{item.content}</Text>
          <TouchableOpacity onPress={handleStop} style={styles.inlineStopBtn} activeOpacity={0.7}>
            <Square color="#E50914" size={10} fill="#E50914" style={{ marginRight: 4 }} />
            <Text style={styles.inlineStopText}>Durdur</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={[styles.msgBox, item.role === 'user' ? styles.userMsg : styles.botMsg]}>
        <Text style={styles.text}>{item.content}</Text>
        {item.movies?.map((movie: any, idx: number) => (
          <MovieCard key={idx} movie={movie} savedIds={favoriteIds} onToggle={fetchFavoriteIds} />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 10), paddingBottom: 15 }]}>
          <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.headerIconButton}>
            <Menu color="#fff" size={24} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Film color="#E50914" size={20} />
            <Text style={styles.headerTitle}>Movie AI</Text>
          </View>
          <TouchableOpacity onPress={openNotificationModal} style={styles.headerIconButton} activeOpacity={0.7}>
            <Bell color="#fff" size={22} />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <FlatList ref={flatListRef} data={loading ? [...messages, { role: 'assistant_loading', content: statusMessage || 'Düşünülüyor...' }] : messages} keyExtractor={(_, index) => index.toString()} contentContainerStyle={styles.listContent} onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" renderItem={renderItem} />

        {suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScrollContent} keyboardShouldPersistTaps="handled">
              {suggestions.map((suggestion, index) => (
                <TouchableOpacity key={index} style={styles.suggestionButton} onPress={() => handleSend(suggestion)} disabled={loading}>
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={[styles.inputArea, { paddingBottom: 15 }]}>
          <TouchableOpacity style={styles.micButton} onPress={isRecording ? stopRecording : startRecording} disabled={loading}>
            {isRecording ? <Square color="#E50914" size={22} /> : <Mic color={loading ? "#888" : "#fff"} size={22} />}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={isRecording ? "Dinleniyor..." : loading ? "Yanıt bekleniyor (durdurabilirsiniz)..." : "Film sor..."}
            placeholderTextColor="#666"
            onSubmitEditing={() => handleSend()}
            editable={!loading && !isRecording}
          />
          {loading ? (
            <TouchableOpacity onPress={handleStop} style={styles.stopButton} activeOpacity={0.7}>
              <Square color="#fff" size={14} fill="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => handleSend()} disabled={!input.trim()} style={styles.sendButton} activeOpacity={0.7}>
              <Send color={input.trim() ? "#E50914" : "#444"} size={24} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* BİLDİRİMLER VE ÖNERİLER MODALI */}
      <Modal
        visible={showNotifications}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            {/* Modal Üst Başlık */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.headerIconContainer}>
                  <Bell color="#E50914" size={20} />
                </View>
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.modalTitle}>Öneriler ve Bildirimler</Text>
                  <Text style={styles.modalSubtitle}>Sana özel hazırlanan film tavsiyeleri</Text>
                </View>
                {unreadCount > 0 && (
                  <View style={styles.modalBadge}>
                    <Text style={styles.modalBadgeText}>{unreadCount} yeni</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.markReadBtn} activeOpacity={0.7}>
                    <CheckCheck color="#E50914" size={16} />
                    <Text style={styles.markReadBtnText}>Okundu Say</Text>
                  </TouchableOpacity>
                )}
                {notifications.length > 0 && (
                  <TouchableOpacity onPress={handleClearNotifications} style={styles.clearBtn} activeOpacity={0.7}>
                    <Trash2 color="#aaa" size={16} />
                    <Text style={styles.clearBtnText}>Temizle</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowNotifications(false)} style={styles.closeBtn} activeOpacity={0.7}>
                  <X color="#aaa" size={22} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Bildirim Listesi */}
            {notificationsLoading && notifications.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#E50914" />
                <Text style={styles.loadingNotifText}>Öneriler yükleniyor...</Text>
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.emptyNotificationContainer}>
                <View style={styles.emptyIconCircle}>
                  <Sparkles color="#E50914" size={38} />
                </View>
                <Text style={styles.emptyNotifTitle}>Henüz bildiriminiz yok</Text>
                <Text style={styles.emptyNotifDesc}>
                  Sohbet ettikçe zevkine uygun filmler yapay zeka tarafından analiz edilip burada listelenecektir 🍿
                </Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => String(item.id)}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.notifListContent}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshingNotifications}
                    onRefresh={() => {
                      setRefreshingNotifications(true);
                      fetchNotifications();
                    }}
                    tintColor="#E50914"
                    colors={['#E50914']}
                  />
                }
                renderItem={({ item }) => {
                  const isUnread = !item.is_read;
                  const poster = item.movie?.Poster || item.data?.movies?.[0]?.Poster || item.movie?.poster_url || item.data?.movies?.[0]?.poster_url;

                  return (
                    <View style={[styles.notifCard, isUnread && styles.notifCardUnread]}>
                      {/* Sol tarafta poster veya film ikonu */}
                      {poster ? (
                        <Image
                          source={{ uri: poster }}
                          style={styles.notifPoster}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : (
                        <View style={[styles.notifIconBox, isUnread && styles.notifIconBoxUnread]}>
                          <Film color={isUnread ? "#E50914" : "#888"} size={20} />
                        </View>
                      )}

                      {/* İçerik Kutusu */}
                      <View style={styles.notifTextBox}>
                        <View style={styles.notifHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6 }}>
                            {isUnread && <View style={styles.unreadDot} />}
                            <Text style={[styles.notifItemTitle, isUnread && styles.notifItemTitleUnread]} numberOfLines={1}>
                              {item.title}
                            </Text>
                            {isUnread && (
                              <View style={styles.newPillBadge}>
                                <Text style={styles.newPillBadgeText}>YENİ</Text>
                              </View>
                            )}
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Clock size={11} color="#666" style={{ marginRight: 3 }} />
                            <Text style={styles.notifTime}>{formatNotificationDate(item.date || item.timestamp)}</Text>
                          </View>
                        </View>

                        <Text style={[styles.notifBody, isUnread && styles.notifBodyUnread]}>
                          {item.body}
                        </Text>

                        {/* Hızlı Aksiyon Butonları */}
                        <View style={styles.notifActionsRow}>
                          <TouchableOpacity
                            style={styles.actionBtnPrimary}
                            activeOpacity={0.7}
                            onPress={() => handleNotificationPress(item)}
                          >
                            <Text style={styles.actionBtnPrimaryText}>Filmi İncele</Text>
                            <ChevronRight color="#E50914" size={14} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.actionBtnSecondary}
                            activeOpacity={0.7}
                            onPress={() => handleAskAboutMovie(item)}
                          >
                            <MessageSquare color="#aaa" size={13} style={{ marginRight: 4 }} />
                            <Text style={styles.actionBtnSecondaryText}>Sohbette Sor</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Sil Butonu */}
                      <TouchableOpacity
                        onPress={() => handleDeleteNotification(item.id)}
                        style={styles.notifDeleteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <X color="#666" size={16} />
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 12, alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#121212' },
  headerIconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
  notificationBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#E50914', borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#121212' },
  notificationBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  listContent: { padding: 15, paddingBottom: 20 },
  msgBox: { padding: 12, borderRadius: 15, marginBottom: 10, maxWidth: '85%' },
  userMsg: { alignSelf: 'flex-end', backgroundColor: '#E50914' },
  botMsg: { alignSelf: 'flex-start', backgroundColor: '#222' },
  text: { color: '#fff', fontSize: 15 },
  loadingMsgBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderWidth: 1, borderColor: '#333' },
  loadingText: { color: '#aaa', fontSize: 14, fontStyle: 'italic' },
  inputArea: { flexDirection: 'row', padding: 10, alignItems: 'center', backgroundColor: '#121212', borderTopWidth: 1, borderTopColor: '#333' },
  micButton: { paddingHorizontal: 10 },
  input: { flex: 1, color: '#fff', backgroundColor: '#222', borderRadius: 25, paddingHorizontal: 18, height: 44, marginHorizontal: 5 },
  sendButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  stopButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E50914', justifyContent: 'center', alignItems: 'center' },
  inlineStopBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginLeft: 10, borderWidth: 1, borderColor: '#E50914' },
  inlineStopText: { color: '#E50914', fontSize: 12, fontWeight: '600' },
  suggestionsContainer: { backgroundColor: '#121212', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#222' },
  suggestionsScrollContent: { paddingHorizontal: 15 },
  suggestionButton: { backgroundColor: '#1E1E1E', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: '#E5091444', marginRight: 8 },
  suggestionText: { color: '#E0E0E0', fontSize: 13, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#161616', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '82%', minHeight: 360, paddingHorizontal: 20, paddingTop: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#282828' },
  headerIconContainer: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#251214', justifyContent: 'center', alignItems: 'center' },
  modalTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  modalSubtitle: { color: '#777', fontSize: 11, marginTop: 1 },
  modalBadge: { backgroundColor: '#E50914', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 8 },
  modalBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  markReadBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#261315', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, marginRight: 8, borderWidth: 1, borderColor: '#E5091444' },
  markReadBtnText: { color: '#E50914', fontSize: 12, marginLeft: 4, fontWeight: '600' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#252525', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, marginRight: 8 },
  clearBtnText: { color: '#bbb', fontSize: 12, marginLeft: 4, fontWeight: '500' },
  closeBtn: { padding: 4 },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 45 },
  loadingNotifText: { color: '#888', fontSize: 13, marginTop: 10 },
  emptyNotificationContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50, paddingHorizontal: 20 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#201618', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#3a181b' },
  emptyNotifTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptyNotifDesc: { color: '#777', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  notifListContent: { paddingVertical: 14 },
  notifCard: { flexDirection: 'row', backgroundColor: '#1E1E1E', borderRadius: 14, padding: 12, marginBottom: 12, alignItems: 'flex-start', borderWidth: 1, borderColor: '#2A2A2A' },
  notifCardUnread: { backgroundColor: '#221517', borderColor: '#E5091455', borderLeftWidth: 3.5, borderLeftColor: '#E50914' },
  notifPoster: { width: 48, height: 72, borderRadius: 8, marginRight: 12, backgroundColor: '#262626' },
  notifIconBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#262626', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  notifIconBoxUnread: { backgroundColor: '#331215' },
  notifTextBox: { flex: 1, marginRight: 8 },
  notifHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  unreadDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#E50914', marginRight: 6 },
  notifItemTitle: { color: '#ddd', fontSize: 14, fontWeight: '600' },
  notifItemTitleUnread: { color: '#fff', fontWeight: 'bold' },
  newPillBadge: { backgroundColor: '#E50914', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6 },
  newPillBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  notifTime: { color: '#777', fontSize: 11 },
  notifBody: { color: '#999', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  notifBodyUnread: { color: '#ccc' },
  notifActionsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2, flexWrap: 'wrap', gap: 8 },
  actionBtnPrimary: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2E1416', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#E5091444' },
  actionBtnPrimaryText: { color: '#E50914', fontSize: 12, fontWeight: '600', marginRight: 2 },
  actionBtnSecondary: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#272727', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  actionBtnSecondaryText: { color: '#bbb', fontSize: 12, fontWeight: '500' },
  notifDeleteBtn: { padding: 4, marginTop: 2 }
});

export default Chat;
