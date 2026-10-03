import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api } from '../api/client';

const AuthScreen = ({ onLoginSuccess }: { onLoginSuccess: (id: number, name: string) => void }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (emailText: string) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(emailText);
  };

  const handleAuth = async () => {
    if (!username || !password || (!isLogin && !email)) {
      Alert.alert("Hata", "Lütfen tüm alanları doldurun.");
      return;
    }

    if (!isLogin && !validateEmail(email)) {
      Alert.alert("Hata", "Lütfen geçerli bir e-posta adresi girin.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Hata", "Şifre en az 6 karakter olmalıdır.");
      return;
    }

    setLoading(true);
    const endpoint = isLogin ? '/login' : '/signup';
    const payload = isLogin ? { username, password } : { username, email, password };

    try {
      const response = await api.post(endpoint, payload);
      if (isLogin) {
        const token = response.data.access_token;
        const userId = response.data.user_id;
        const userName = response.data.username;

        // Token ve kullanıcı bilgilerini kalıcı olarak kaydet
        await SecureStore.setItemAsync('user_token', token);
        await SecureStore.setItemAsync('user_data', JSON.stringify({ id: userId, name: userName }));

        onLoginSuccess(userId, userName);
      } else {
        Alert.alert("Başarılı", "Kayıt olundu, şimdi giriş yapabilirsiniz.");
        setIsLogin(true);
      }
    } catch (error: any) {
      Alert.alert("Hata", error.response?.data?.detail || "Bir sorun oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.authContainer}>
      <Text style={styles.title}>{isLogin ? 'Giriş Yap' : 'Kayıt Ol'}</Text>
      <TextInput style={styles.input} placeholder="Kullanıcı Adı" placeholderTextColor="#999" value={username} onChangeText={setUsername} autoCapitalize="none" />
      {!isLogin && (
        <TextInput style={styles.input} placeholder="E-posta" placeholderTextColor="#999" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      )}
      <TextInput style={styles.input} placeholder="Şifre" placeholderTextColor="#999" secureTextEntry value={password} onChangeText={setPassword} />
      <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isLogin ? 'Giriş' : 'Kayıt Ol'}</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
        <Text style={styles.switchText}>
          {isLogin ? 'Hesabınız yok mu? Kayıt olun' : 'Zaten hesabınız var mı? Giriş yapın'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  authContainer: { flex: 1, backgroundColor: '#121212', justifyContent: 'center', padding: 20 },
  title: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  input: { backgroundColor: '#2C2C2C', borderRadius: 8, padding: 15, color: '#fff', marginBottom: 15, fontSize: 16 },
  button: { backgroundColor: '#E50914', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  switchText: { color: '#999', textAlign: 'center', marginTop: 20 },
});

export default AuthScreen;