// components/Discover.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Compass } from 'lucide-react-native';
import { api } from '../api/client';
import MovieCard from './Card';

const Discover = () => {
    const insets = useSafeAreaInsets();
    const [movies, setMovies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeCategory, setActiveCategory] = useState('Popüler');
    const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

    const categories = ['Popüler', 'Vizyondakiler', 'En Çok Oy Alanlar', 'Yakında'];

    const fetchDiscoverMovies = async () => {
        setLoading(true);
        try {
            // Not: Backend tarafında bu endpoint'leri (örneğin TMDB'den çeken) oluşturmalısın. 
            // Şimdilik varsayılan bir endpoint'e istek atıyoruz.
            const res = await api.get(`/discover?category=${activeCategory}`);

            // Gelen veri formatı AI sohbetindekiyle aynı olmalı (res.data.movies)
            if (res.data && res.data.movies) {
                setMovies(res.data.movies);
            }

            // Favori ID'lerini de alalım ki butonlar doğru yansısın
            const favRes = await api.get(`/favorites/ids`);
            setFavoriteIds(favRes.data.favorite_ids || []);
        } catch (e) {
            console.error("Keşfet verileri alınamadı:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDiscoverMovies();
    }, [activeCategory]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchDiscoverMovies();
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
            <View style={styles.header}>
                <Compass color="#E50914" size={28} />
                <Text style={styles.headerTitle}>Keşfet</Text>
            </View>

            <View style={styles.categoriesContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
                    {categories.map((cat, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[styles.categoryBtn, activeCategory === cat && styles.activeCategoryBtn]}
                            onPress={() => setActiveCategory(cat)}
                        >
                            <Text style={[styles.categoryText, activeCategory === cat && styles.activeCategoryText]}>
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading && !refreshing ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#E50914" />
                </View>
            ) : (
                <FlatList
                    data={movies}
                    keyExtractor={(item, index) => String(item.movie_id || item.id || index)}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E50914" />}
                    renderItem={({ item }) => (
                        <MovieCard
                            movie={item}
                            savedIds={favoriteIds}
                            onToggle={fetchDiscoverMovies}
                        />
                    )}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>Bu kategoride film bulunamadı.</Text>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
    headerTitle: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginLeft: 10 },
    categoriesContainer: { marginBottom: 15 },
    categoriesScroll: { paddingHorizontal: 15 },
    categoryBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1A1A1A', marginRight: 10, borderWidth: 1, borderColor: '#333' },
    activeCategoryBtn: { backgroundColor: '#E50914', borderColor: '#E50914' },
    categoryText: { color: '#888', fontSize: 14, fontWeight: '600' },
    activeCategoryText: { color: '#fff' },
    listContent: { paddingHorizontal: 15, paddingBottom: 20 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: '#666', textAlign: 'center', marginTop: 50, fontSize: 16 }
});

export default Discover;