import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, Settings, LogOut, ChevronRight, Info, ShieldCheck, X, PieChart, Clapperboard } from 'lucide-react-native';
import { api } from '../api/client';

const Profile = ({ username, onLogout, onChangeUsername }: { username: string, onLogout: () => void, onChangeUsername: (newName: string) => void }) => {
  const insets = useSafeAreaInsets();

  const [favoriteCount, setFavoriteCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);

  // YENİ: Tek bir string yerine sayıları tutacağımız listeler (Diziler)
  const [genreStats, setGenreStats] = useState<{ name: string, count: number }[]>([]);
  const [directorStats, setDirectorStats] = useState<{ name: string, count: number }[]>([]);

  // Modal Durumları
  const [isEditUserVisible, setIsEditUserVisible] = useState(false);
  const [newUsername, setNewUsername] = useState(username);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [isChangePassVisible, setIsChangePassVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  const fetchStats = async () => {
    try {
      const favsRes = await api.get(`/favorites`);
      const favorites = favsRes.data.favorites || [];
      setFavoriteCount(favorites.length);

      if (favorites.length > 0) {
        const genreCounts: Record<string, number> = {};
        const directorCounts: Record<string, number> = {};

        // Her bir favori filmi dönüp sayıları topluyoruz
        favorites.forEach((fav: any) => {
          if (fav['Türler']) {
            fav['Türler'].split(',').forEach((g: string) => {
              const cleanG = g.trim();
              if (cleanG) genreCounts[cleanG] = (genreCounts[cleanG] || 0) + 1;
            });
          }
          if (fav['Director'] && fav['Director'] !== 'Bilinmiyor') {
            const dir = fav['Director'].trim();
            directorCounts[dir] = (directorCounts[dir] || 0) + 1;
          }
        });

        // Sayıları büyükten küçüğe sıralayıp ilk 5'ini alıyoruz
        const sortedGenres = Object.entries(genreCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        const sortedDirectors = Object.entries(directorCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setGenreStats(sortedGenres);
        setDirectorStats(sortedDirectors);
      }

      const sessionsRes = await api.get(`/sessions`);
      setChatCount(sessionsRes.data.sessions?.length || 0);
    } catch (e) {
      console.error("İstatistikler yüklenemedi", e);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) return Alert.alert("Hata", "Kullanıcı adı boş olamaz.");
    setIsUpdatingUser(true);
    try {
      const res = await api.post(`/update-profile`, { new_username: newUsername.trim() });
      if (res.data.status === "success") {
        onChangeUsername(newUsername.trim());
        setIsEditUserVisible(false);
        Alert.alert("Başarılı", "Kullanıcı adınız güncellendi.");
      }
    } catch (error: any) { Alert.alert("Hata", error.response?.data?.detail || "Hata oluştu."); }
    finally { setIsUpdatingUser(false); }
  };

  const handleUpdatePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) return Alert.alert("Hata", "Lütfen tüm alanları doldurun.");
    if (newPassword !== confirmPassword) return Alert.alert("Hata", "Yeni şifreler eşleşmiyor.");
    setIsChangingPass(true);
    try {
      const res = await api.post(`/change-password`, { old_password: oldPassword, new_password: newPassword });
      if (res.data.status === "success") {
        setIsChangePassVisible(false);
        setOldPassword(''); setNewPassword(''); setConfirmPassword('');
        Alert.alert("Başarılı", "Şifreniz başarıyla değiştirildi.");
      }
    } catch (error: any) { Alert.alert("Hata", error.response?.data?.detail || "Hata oluştu."); }
    finally { setIsChangingPass(false); }
  };

  const MenuItem = ({ icon: Icon, title, onPress, color = "#fff" }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuItemLeft}>
        <View style={styles.iconContainer}><Icon size={20} color={color} /></View>
        <Text style={[styles.menuItemText, { color }]}>{title}</Text>
      </View>
      <ChevronRight size={20} color="#444" />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarPlaceholder}><User size={50} color="#fff" /></View>
            <TouchableOpacity style={styles.editBadge} onPress={() => { setNewUsername(username); setIsEditUserVisible(true); }}>
              <Settings size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.username}>{username || "Kullanıcı"}</Text>
          <Text style={styles.subText}>{favoriteCount > 5 ? 'Sinefil (Cinephile)' : 'Film Tutkunu'}</Text>
        </View>

        {/* DETAYLI ANALİZ KARTI */}
        <View style={styles.insightsCard}>
          <Text style={styles.insightsTitle}>Film Zevki Analizi</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{favoriteCount}</Text>
              <Text style={styles.statLabel}>Favori</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{chatCount}</Text>
              <Text style={styles.statLabel}>Sohbet</Text>
            </View>
          </View>

          {/* Tür Dağılımı Listesi */}
          {genreStats.length > 0 && (
            <View style={styles.listSection}>
              <View style={styles.listHeaderRow}>
                <PieChart size={16} color="#E50914" />
                <Text style={styles.listTitle}>En Çok Eklenen Türler</Text>
              </View>
              <View style={styles.tagsContainer}>
                {genreStats.map((item, index) => (
                  <View key={index} style={styles.tagBadge}>
                    <Text style={styles.tagName}>{item.name}</Text>
                    <View style={styles.tagCountBg}>
                      <Text style={styles.tagCount}>{item.count}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Yönetmen Dağılımı Listesi */}
          {directorStats.length > 0 && (
            <View style={[styles.listSection, { marginTop: 15, borderTopWidth: 1, borderTopColor: '#222', paddingTop: 15 }]}>
              <View style={styles.listHeaderRow}>
                <Clapperboard size={16} color="#E50914" />
                <Text style={styles.listTitle}>Favori Yönetmenler</Text>
              </View>
              {directorStats.map((item, index) => (
                <View key={index} style={styles.directorRow}>
                  <Text style={styles.directorName}>{item.name}</Text>
                  <Text style={styles.directorCount}>{item.count} Film</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Hesap Ayarları</Text>
          <MenuItem icon={User} title="Profil Bilgilerini Düzenle" onPress={() => setIsEditUserVisible(true)} />
          <MenuItem icon={ShieldCheck} title="Gizlilik ve Güvenlik" onPress={() => setIsChangePassVisible(true)} />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Uygulama</Text>
          <MenuItem icon={Info} title="Hakkında" onPress={() => Alert.alert("Movie AI", "Sürüm 1.1.0")} />
          <MenuItem icon={LogOut} title="Çıkış Yap" color="#E50914" onPress={onLogout} />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modallar (İçeriği aynı kalacak) */}
      <Modal visible={isEditUserVisible} animationType="fade" transparent={true} onRequestClose={() => setIsEditUserVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profilini Düzenle</Text>
              <TouchableOpacity onPress={() => setIsEditUserVisible(false)}><X color="#fff" size={20} /></TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Kullanıcı Adı</Text>
            <TextInput style={styles.textInput} value={newUsername} onChangeText={setNewUsername} placeholderTextColor="#666" />
            <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateUsername} disabled={isUpdatingUser}>
              {isUpdatingUser ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Kaydet</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isChangePassVisible} animationType="fade" transparent={true} onRequestClose={() => setIsChangePassVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gizlilik ve Güvenlik</Text>
              <TouchableOpacity onPress={() => setIsChangePassVisible(false)}><X color="#fff" size={20} /></TouchableOpacity>
            </View>
            <Text style={styles.inputLabel}>Mevcut Şifre</Text>
            <TextInput style={styles.textInput} value={oldPassword} onChangeText={setOldPassword} secureTextEntry placeholderTextColor="#666" />
            <Text style={styles.inputLabel}>Yeni Şifre</Text>
            <TextInput style={styles.textInput} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholderTextColor="#666" />
            <Text style={styles.inputLabel}>Yeni Şifre Tekrar</Text>
            <TextInput style={styles.textInput} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholderTextColor="#666" />
            <TouchableOpacity style={styles.saveBtn} onPress={handleUpdatePassword} disabled={isChangingPass}>
              {isChangingPass ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Şifreyi Değiştir</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { alignItems: 'center', paddingVertical: 30 },
  avatarContainer: { position: 'relative', marginBottom: 15 },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#E50914' },
  editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#E50914', padding: 8, borderRadius: 20 },
  username: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  subText: { color: '#999', fontSize: 14, marginTop: 4 },

  insightsCard: { backgroundColor: '#121212', marginHorizontal: 20, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#222', marginTop: 10, shadowColor: '#E50914', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  insightsTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', marginBottom: 20 },
  statBox: { alignItems: 'center', flex: 1 },
  statNumber: { color: '#E50914', fontSize: 26, fontWeight: 'bold' },
  statLabel: { color: '#888', fontSize: 12, marginTop: 4, textTransform: 'uppercase' },
  statDivider: { width: 1, height: 40, backgroundColor: '#333' },

  // YENİ EKLENEN STİLLER
  listSection: { marginTop: 5 },
  listHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  listTitle: { color: '#ccc', fontSize: 14, fontWeight: 'bold', marginLeft: 8 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagBadge: { flexDirection: 'row', backgroundColor: '#1A1A1A', borderRadius: 20, paddingLeft: 12, paddingRight: 4, paddingVertical: 6, alignItems: 'center', borderWidth: 1, borderColor: '#333', marginBottom: 8, marginRight: 8 },
  tagName: { color: '#E0E0E0', fontSize: 13, marginRight: 8 },
  tagCountBg: { backgroundColor: '#E50914', borderRadius: 12, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  tagCount: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  directorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: '#222' },
  directorName: { color: '#E0E0E0', fontSize: 14 },
  directorCount: { color: '#888', fontSize: 13, fontWeight: '500' },

  menuSection: { marginTop: 30, paddingHorizontal: 20 },
  sectionTitle: { color: '#555', fontSize: 13, fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 0.5, borderBottomColor: '#222' },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: { width: 35, alignItems: 'center' },
  menuItemText: { fontSize: 16, marginLeft: 10, fontWeight: '500' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#1A1A1A', width: '100%', borderRadius: 15, padding: 20, borderWidth: 0.5, borderColor: '#333' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 0.5, borderBottomColor: '#333', paddingBottom: 10 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  inputLabel: { color: '#BBB', fontSize: 14, marginBottom: 8, fontWeight: '500' },
  textInput: { backgroundColor: '#2C2C2C', borderRadius: 8, padding: 12, color: '#fff', fontSize: 16, marginBottom: 20 },
  saveBtn: { backgroundColor: '#E50914', padding: 14, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});

export default Profile;