import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView, Modal } from 'react-native';
import { Send, Menu, Film, Mic, Square, Bell, BellOff, X, Trash2, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { api } from '../api/client';
import { normalizeMovie } from '../utils/normalization';
import MovieCard from './Card';

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
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(['Bilim kurgu filmi öner', 'Nolan filmi öner', 'Tim Burton filmi öner']);

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
  }, []);

  // Bildirimleri kaydetme yardımcısı
  const saveNotifications = async (updated: any[]) => {
    setNotifications(updated);
    try {
      await SecureStore.setItemAsync('user_notifications', JSON.stringify(updated));
    } catch (e) {
      console.error("Bildirim kaydedilemedi:", e);
    }
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

    const addNotification = (notif: any) => {
      const newNotif = {
        id: notif.request?.identifier || String(Date.now()),
        title: notif.request?.content?.title || '🎬 Yeni Bildirim',
        body: notif.request?.content?.body || '',
        data: notif.request?.content?.data || null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
      };
      setNotifications((prev) => {
        const updated = [newNotif, ...prev.filter((n) => n.id !== newNotif.id)];
        SecureStore.setItemAsync('user_notifications', JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    };

    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      addNotification(notification);
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const notifData = response.notification?.request?.content?.data;
      addNotification(response.notification);

      let targetRawMovie = null;
      if (Array.isArray(notifData?.movies) && notifData.movies.length > 0) {
        if (notifData.movie_title) {
          const targetTitle = String(notifData.movie_title).toLowerCase();
          targetRawMovie = notifData.movies.find((m: any) => 
            (m.Film || m.title || '').toLowerCase() === targetTitle
          ) || notifData.movies[0];
        } else {
          targetRawMovie = notifData.movies[0];
        }
      } else if (notifData?.movie) {
        targetRawMovie = notifData.movie;
      } else if (notifData?.movie_title) {
        targetRawMovie = {
          ...notifData,
          title: notifData.movie_title,
          overview: response.notification?.request?.content?.body || notifData.overview,
        };
      }

      if (targetRawMovie) {
        const movie = normalizeMovie(targetRawMovie);
        navigation.navigate('MovieDetail', { movie, savedIds: favoriteIds, onToggle: fetchFavoriteIds });
      }
    });

    return () => {
      receivedSub?.remove?.();
      responseSub?.remove?.();
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, []);

  const handleClearNotifications = async () => {
    await saveNotifications([]);
  };

  const handleDeleteNotification = async (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    await saveNotifications(updated);
  };

  const handleNotificationPress = (notif: any) => {
    setShowNotifications(false);

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
    } else if (notif.data?.movie) {
      targetRawMovie = notif.data.movie;
    } else if (notif.data?.movie_title) {
      targetRawMovie = {
        ...notif.data,
        title: notif.data.movie_title,
        overview: notif.body || notif.data?.overview,
      };
    }

    if (targetRawMovie) {
      const movie = normalizeMovie(targetRawMovie);
      navigation.navigate('MovieDetail', { movie, savedIds: favoriteIds, onToggle: fetchFavoriteIds });
    } else if (notif.body) {
      handleSend(notif.body);
    }
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
          <TouchableOpacity onPress={() => setShowNotifications(true)} style={styles.headerIconButton} activeOpacity={0.7}>
            <Bell color="#fff" size={22} />
            {notifications.length > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {notifications.length > 9 ? '9+' : notifications.length}
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

      {/* BİLDİRİMLER MODALI */}
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
                <Bell color="#E50914" size={20} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Bildirimler</Text>
                {notifications.length > 0 && (
                  <View style={styles.modalBadge}>
                    <Text style={styles.modalBadgeText}>{notifications.length}</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
            {notifications.length === 0 ? (
              <View style={styles.emptyNotificationContainer}>
                <View style={styles.emptyIconCircle}>
                  <BellOff color="#666" size={38} />
                </View>
                <Text style={styles.emptyNotifTitle}>Henüz bildiriminiz yok</Text>
                <Text style={styles.emptyNotifDesc}>
                  Size özel öneriler ve güncellemeler geldiğinde burada saklanacaktır.
                </Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.notifListContent}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.notifCard}
                    activeOpacity={0.8}
                    onPress={() => handleNotificationPress(item)}
                  >
                    <View style={styles.notifIconBox}>
                      <Film color="#E50914" size={18} />
                    </View>
                    <View style={styles.notifTextBox}>
                      <View style={styles.notifHeaderRow}>
                        <Text style={styles.notifItemTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.notifTime}>{item.timestamp || item.date}</Text>
                      </View>
                      <Text style={styles.notifBody}>{item.body}</Text>
                      {(item.data?.movie_title || item.data?.movies || item.data?.movie) && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                          <Text style={{ color: '#E50914', fontSize: 12, fontWeight: '600', marginRight: 2 }}>Filmi İncele</Text>
                          <ChevronRight color="#E50914" size={14} />
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteNotification(item.id)}
                      style={styles.notifDeleteBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X color="#666" size={16} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#181818', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', minHeight: 340, paddingHorizontal: 20, paddingTop: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#282828' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalBadge: { backgroundColor: '#E50914', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 8 },
  modalBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#252525', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, marginRight: 10 },
  clearBtnText: { color: '#bbb', fontSize: 12, marginLeft: 4, fontWeight: '500' },
  closeBtn: { padding: 4 },
  emptyNotificationContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50, paddingHorizontal: 20 },
  emptyIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyNotifTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptyNotifDesc: { color: '#777', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  notifListContent: { paddingVertical: 14 },
  notifCard: { flexDirection: 'row', backgroundColor: '#222', borderRadius: 14, padding: 12, marginBottom: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2c2c2c' },
  notifIconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2a1517', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  notifTextBox: { flex: 1, marginRight: 8 },
  notifHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  notifItemTitle: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1, marginRight: 6 },
  notifTime: { color: '#777', fontSize: 11 },
  notifBody: { color: '#bbb', fontSize: 13, lineHeight: 17 },
  notifDeleteBtn: { padding: 6 }
});

export default Chat;