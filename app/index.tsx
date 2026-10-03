import '../utils/patch-console';
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator, DrawerContentScrollView } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Plus, LogOut, MessageSquare, Trash2, User as UserIcon, Bookmark, MessageCircle, X, Compass } from 'lucide-react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import * as SecureStore from 'expo-secure-store';
import { LogBox } from 'react-native';
LogBox.ignoreLogs([
  "Passing an object as the argument to 'navigate' is deprecated",
]);

import { api } from '../api/client';
import AuthScreen from '../components/AuthScreen';
import Chat from '../components/Chat';
import Watchlist from '../components/WatchList';
import Profile from '../components/Profile';
import MovieCard from '../components/Card';
import MovieDetail from '../components/MovieDetail';
import Discover from '../components/Discover';
import Onboarding from '../components/Onboarding';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();
const Tab = createBottomTabNavigator();

// --- ALT SEKME NAVİGASYONU ---
function MainTabs({ userId, username, sessionId, messages, setMessages, fetchSessions, onShowRecommendations, onLogout, onChangeUsername }: any) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#121212', borderTopColor: '#333' },
        tabBarActiveTintColor: '#E50914',
        tabBarInactiveTintColor: '#888',
      }}
    >
      <Tab.Screen name="Chat" options={{ title: 'Sohbet', tabBarIcon: ({ color }) => <MessageCircle color={color} size={24} /> }}>
        {(props) => <Chat {...props} userId={userId} sessionId={sessionId} messages={messages} setMessages={setMessages} fetchSessions={fetchSessions} onShowRecommendations={onShowRecommendations} />}
      </Tab.Screen>

      {/* YENİ EKLENEN KEŞFET SEKMESİ */}
      <Tab.Screen name="Keşfet" options={{ tabBarIcon: ({ color }) => <Compass color={color} size={24} /> }}>
        {() => <Discover />}
      </Tab.Screen>

      <Tab.Screen name="Favoriler" options={{ tabBarIcon: ({ color }) => <Bookmark color={color} size={24} /> }}>
        {() => <Watchlist />}
      </Tab.Screen>

      <Tab.Screen name="Profil" options={{ tabBarIcon: ({ color }) => <UserIcon color={color} size={24} /> }}>
        {() => <Profile username={username} onLogout={onLogout} onChangeUsername={onChangeUsername} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// --- YAN MENÜ ---
const CustomDrawerContent = (props: any) => {
  const { username, currentSessionId, setSessionId, sessions, fetchSessions, onLogout } = props;

  const handleNewChat = () => {
    setSessionId(uuidv4());
    props.navigation.closeDrawer();
  };

  const handleDeleteSession = async (sId: string) => {
    Alert.alert("Sohbeti Sil", "Bu sohbet geçmişi kalıcı olarak silinecek.", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil", style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/chat/${sId}`);
            fetchSessions();
            if (currentSessionId === sId) handleNewChat();
          } catch (e) { console.error(e); }
        }
      }
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      <DrawerContentScrollView {...props}>
        <View style={styles.sidebarHeader}>
          <UserIcon color="#E50914" size={24} />
          <Text style={styles.usernameText}>{username}</Text>
        </View>
        <View style={styles.sidebarActions}>
          <TouchableOpacity style={styles.newChatBtn} onPress={handleNewChat}>
            <Plus color="#fff" size={20} />
            <Text style={styles.btnText}>Yeni Sohbet</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <LogOut color="#fff" size={20} />
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionTitle}>Geçmiş Sohbetler</Text>
        {sessions.map((s: any) => (
          <View key={s.session_id} style={[styles.sessionItem, currentSessionId === s.session_id && styles.activeSession]}>
            <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => { setSessionId(s.session_id); props.navigation.closeDrawer(); }}>
              <MessageSquare color={currentSessionId === s.session_id ? "#E50914" : "#888"} size={18} />
              <Text numberOfLines={1} style={[styles.sessionText, currentSessionId === s.session_id && styles.activeText]}>{s.title || "İsimsiz Sohbet"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDeleteSession(s.session_id)}>
              <Trash2 color="#555" size={18} />
            </TouchableOpacity>
          </View>
        ))}
      </DrawerContentScrollView>
    </View>
  );
};

// --- ANA BİLEŞEN ---
export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<{ id: number; name: string } | null>(null);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false); // YENİ STATE

  const [sessionId, setSessionId] = useState(uuidv4());
  const [sessions, setSessions] = useState([]);
  const [messages, setMessages] = useState([]);

  const [recommendedMovies, setRecommendedMovies] = useState<any[]>([]);
  const [isRecommendationsVisible, setIsRecommendationsVisible] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const userData = await SecureStore.getItemAsync('user_data');
        const token = await SecureStore.getItemAsync('user_token');
        const onboardingStatus = await SecureStore.getItemAsync('has_seen_onboarding'); // ONBOARDING KONTROLÜ

        if (userData && token) {
          setUser(JSON.parse(userData));
        }

        if (onboardingStatus === 'true') {
          setHasSeenOnboarding(true);
        }
      } catch (e) {
        console.error("Oturum kontrol hatası:", e);
      } finally {
        setIsReady(true);
      }
    };
    checkUserSession();
  }, []);

  const handleLoginSuccess = (id: number, name: string) => setUser({ id, name });

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('user_token');
    await SecureStore.deleteItemAsync('user_data');
    setUser(null);
  };

  const finishOnboarding = async () => {
    await SecureStore.setItemAsync('has_seen_onboarding', 'true');
    setHasSeenOnboarding(true);
  };

  const fetchSessions = async () => {
    if (!user) return;
    try {
      const res = await api.get(`/sessions`);
      setSessions(res.data.sessions || []);
    } catch (e) { }
  };

  const fetchFavoriteIds = async () => {
    if (!user) return;
    try {
      const res = await api.get(`/favorites/ids`);
      setFavoriteIds(res.data.favorite_ids || []);
    } catch (e) { }
  };

  useEffect(() => {
    if (user) {
      fetchSessions();
      fetchFavoriteIds();
    }
  }, [user, sessionId]);

  if (!isReady) return <View style={styles.loadingScreen}><ActivityIndicator size="large" color="#E50914" /></View>;

  // KULLANICI GİRİŞ YAPMAMIŞSA
  if (!user) return <AuthScreen onLoginSuccess={handleLoginSuccess} />;

  // GİRİŞ YAPMIŞ AMA ONBOARDING GÖRMEMİŞSE
  if (!hasSeenOnboarding) return <Onboarding onFinish={finishOnboarding} />;

  return (
    <NavigationContainer independent={true}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* Ana Yapı (Drawer & Tabs) */}
        <Stack.Screen name="DrawerRoot">
          {() => (
            <Drawer.Navigator
              drawerContent={(props) => (
                <CustomDrawerContent {...props} username={user.name} currentSessionId={sessionId} setSessionId={setSessionId} sessions={sessions} fetchSessions={fetchSessions} onLogout={handleLogout} />
              )}
              screenOptions={{ headerShown: false, drawerStyle: { width: '80%' } }}
            >
              <Drawer.Screen name="Main">
                {(props) => (
                  <MainTabs {...props} userId={user.id} username={user.name} sessionId={sessionId} messages={messages} setMessages={setMessages} fetchSessions={fetchSessions} onShowRecommendations={(movies: any[]) => { setRecommendedMovies(movies); setIsRecommendationsVisible(true); }} onLogout={handleLogout} onChangeUsername={(newName: string) => setUser(prev => prev ? { ...prev, name: newName } : null)} />
                )}
              </Drawer.Screen>
            </Drawer.Navigator>
          )}
        </Stack.Screen>

        {/* Yeni Detay Sayfası */}
        <Stack.Screen
          name="MovieDetail"
          component={MovieDetail}
          options={{ presentation: 'modal' }}
        />
      </Stack.Navigator>

      <Modal visible={isRecommendationsVisible} animationType="slide" onRequestClose={() => setIsRecommendationsVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Senin İçin Öneriler 🍿</Text>
            <TouchableOpacity onPress={() => setIsRecommendationsVisible(false)} style={styles.modalCloseBtn}><X color="#fff" size={24} /></TouchableOpacity>
          </View>
          {recommendedMovies.length === 0 ? (
            <View style={styles.modalEmpty}><Text style={styles.modalEmptyText}>Öneri film bulunamadı.</Text></View>
          ) : (
            <FlatList data={recommendedMovies} keyExtractor={(item, idx) => idx.toString()} contentContainerStyle={styles.modalListContent} renderItem={({ item }) => <MovieCard movie={item} savedIds={favoriteIds} onToggle={fetchFavoriteIds} />} />
          )}
        </SafeAreaView>
      </Modal>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' },
  sidebarHeader: { padding: 20, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#333' },
  usernameText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  sidebarActions: { flexDirection: 'row', padding: 15, justifyContent: 'space-between' },
  newChatBtn: { flex: 1, backgroundColor: '#E50914', flexDirection: 'row', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  logoutBtn: { backgroundColor: '#333', padding: 12, borderRadius: 8, justifyContent: 'center' },
  btnText: { color: '#fff', marginLeft: 8, fontWeight: '600' },
  sectionTitle: { color: '#666', fontSize: 12, marginLeft: 20, marginBottom: 10, textTransform: 'uppercase', marginTop: 10 },
  sessionItem: { flexDirection: 'row', padding: 12, marginHorizontal: 10, borderRadius: 8, marginBottom: 4 },
  activeSession: { backgroundColor: '#222' },
  sessionText: { color: '#aaa', marginLeft: 10, fontSize: 14 },
  activeText: { color: '#fff', fontWeight: 'bold' },
  modalContainer: { flex: 1, backgroundColor: '#121212' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  modalCloseBtn: { padding: 5 },
  modalListContent: { padding: 20 },
  modalEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalEmptyText: { color: '#888', fontSize: 16 }
});