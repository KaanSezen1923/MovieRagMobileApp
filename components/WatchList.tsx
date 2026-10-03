import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Trash2 } from 'lucide-react-native';
import { api } from '../api/client';
import MovieCard from './Card';

const Watchlist = () => {
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFavorites = async () => {
    try {
      const res = await api.get(`/favorites`);
      setFavorites(res.data.favorites || []);
    } catch (e) {
      console.error("Favoriler yüklenemedi", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFavorites();
  };

  useFocusEffect(
    useCallback(() => {
      fetchFavorites();
    }, [])
  );

  const removeFavorite = async (movieId: string) => {
    try {
      await api.delete(`/favorites/${encodeURIComponent(movieId)}`);
      setFavorites(prev => prev.filter(item => (item.movie_id || item.id) !== movieId));
    } catch (e) {
      console.error("Silme hatası", e);
    }
  };

  if (loading) return <ActivityIndicator style={{ flex: 1, backgroundColor: '#000' }} color="#E50914" />;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 15 }]}>
      <Text style={styles.header}>İzleme Listem</Text>
      <FlatList
        data={favorites}
        keyExtractor={(item, index) => String(item.movie_id || index)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E50914" />}
        renderItem={({ item }) => (
          <View style={styles.itemContainer}>
            <MovieCard
              movie={item}
              savedIds={favorites.map(f => f.movie_id || f.id || f.title)}
              onToggle={fetchFavorites}
            />
            <TouchableOpacity style={styles.deleteButton} onPress={() => removeFavorite(item.movie_id || item.id)}>
              <Trash2 color="#fff" size={18} />
              <Text style={styles.deleteText}>Listeden Çıkar</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Henüz film kaydetmediniz.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingHorizontal: 15 },
  header: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  itemContainer: { marginBottom: 20 },
  deleteButton: { flexDirection: 'row', backgroundColor: '#333', padding: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: -10 },
  deleteText: { color: '#fff', marginLeft: 8, fontWeight: 'bold' },
  empty: { color: '#999', textAlign: 'center', marginTop: 50 }
});

export default Watchlist;