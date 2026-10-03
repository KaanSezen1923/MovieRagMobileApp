// components/MovieDetail.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Star, PlayCircle, Bookmark } from 'lucide-react-native';
import { api } from '../api/client';
import { normalizeMovie } from '../utils/normalization';

const MovieDetail = ({ route, navigation }: any) => {
    const rawMovie = route.params?.movie || {};
    const movie = normalizeMovie(rawMovie);
    const insets = useSafeAreaInsets();

    const [isSaved, setIsSaved] = useState<boolean>(() => {
        if (route.params?.isSaved !== undefined) return Boolean(route.params.isSaved);
        if (Array.isArray(route.params?.savedIds)) {
            return route.params.savedIds.some(
                (id: string) =>
                    id === movie.id ||
                    id === movie.title ||
                    (movie.id && String(id).toLowerCase() === String(movie.id).toLowerCase()) ||
                    (movie.title && String(id).toLowerCase() === String(movie.title).toLowerCase())
            );
        }
        return false;
    });
    const [loadingFavorite, setLoadingFavorite] = useState(false);

    // Bildirim veya diğer yerlerden gelindiğinde güncel favori listesini backend'den çekip durumu senkronize et
    useEffect(() => {
        let isMounted = true;
        const checkFavoriteStatus = async () => {
            try {
                const res = await api.get('/favorites/ids');
                const favoriteIds: string[] = res.data?.favorite_ids || [];
                if (isMounted) {
                    const found = favoriteIds.some(
                        (id: string) =>
                            id === movie.id ||
                            id === movie.title ||
                            (movie.id && String(id).toLowerCase() === String(movie.id).toLowerCase()) ||
                            (movie.title && String(id).toLowerCase() === String(movie.title).toLowerCase())
                    );
                    setIsSaved(found);
                }
            } catch (e) {
                console.error("Favori durumu kontrol edilemedi:", e);
            }
        };

        checkFavoriteStatus();
        return () => {
            isMounted = false;
        };
    }, [movie.id, movie.title]);

    const handleToggleFavorite = async () => {
        if (loadingFavorite) return;
        setLoadingFavorite(true);
        const nextSaved = !isSaved;
        setIsSaved(nextSaved); // İyimser (optimistic) güncelleme

        try {
            if (!nextSaved) {
                // Favorilerden çıkar
                try {
                    await api.delete(`/favorites/${encodeURIComponent(movie.id)}`);
                } catch (delErr) {
                    if (movie.title && movie.title !== movie.id) {
                        await api.delete(`/favorites/${encodeURIComponent(movie.title)}`);
                    } else {
                        throw delErr;
                    }
                }
            } else {
                // Favorilere ekle
                const payload = {
                    movie_id: movie.id,
                    title: movie.title,
                    genres: movie.genres || [],
                    director: movie.director || 'Bilinmiyor',
                    cast_members: movie.cast || 'Bilinmiyor',
                    poster_url: movie.posterUrl,
                    imdb_rating: movie.rating || 'N/A',
                    trailer_url: movie.trailerUrl || ''
                };
                await api.post(`/favorites`, payload);
            }

            if (route.params?.onToggle) {
                route.params.onToggle();
            }
        } catch (error) {
            console.error("Favori işlemi hatası:", error);
            setIsSaved(!nextSaved); // Hata durumunda eski duruma geri al
            Alert.alert("Hata", "Favori işlemi gerçekleştirilemedi. Lütfen bağlantınızı kontrol edip tekrar deneyin.");
        } finally {
            setLoadingFavorite(false);
        }
    };

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <ScrollView bounces={false}>
                <View style={styles.imageContainer}>
                    <Image
                        source={{ uri: movie.posterUrl }}
                        style={styles.poster}
                        contentFit="cover"
                        transition={300}
                    />
                    {/* Geri Tuşu ve Üst Favori Butonu */}
                    <View style={[styles.headerActions, { top: Math.max(insets.top, 20) }]}>
                        <TouchableOpacity 
                            style={styles.iconButton} 
                            onPress={() => navigation.goBack()}
                            activeOpacity={0.7}
                        >
                            <ChevronLeft color="#fff" size={28} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.iconButton, isSaved && styles.iconButtonSaved]} 
                            onPress={handleToggleFavorite}
                            activeOpacity={0.7}
                            disabled={loadingFavorite}
                        >
                            {loadingFavorite ? (
                                <ActivityIndicator size="small" color="#E50914" />
                            ) : (
                                <Bookmark 
                                    color={isSaved ? "#E50914" : "#fff"} 
                                    fill={isSaved ? "#E50914" : "transparent"} 
                                    size={24} 
                                />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.content}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>{movie.title}</Text>
                        <View style={styles.ratingBadge}>
                            <Star size={16} color="#FFD700" fill="#FFD700" />
                            <Text style={styles.ratingText}>{movie.rating}</Text>
                        </View>
                    </View>

                    <Text style={styles.infoText}><Text style={styles.bold}>Yönetmen:</Text> {movie.director}</Text>
                    <Text style={styles.infoText}><Text style={styles.bold}>Oyuncular:</Text> {movie.cast}</Text>

                    <Text style={styles.sectionTitle}>Özet</Text>
                    <Text style={styles.summary}>{movie.summary || 'Bu film için özet bulunmamaktadır.'}</Text>

                    {/* Aksiyon Butonları (Favorilere Ekle / Fragmanı İzle) */}
                    <View style={styles.actionsContainer}>
                        <TouchableOpacity
                            style={[styles.favoriteActionButton, isSaved && styles.favoriteActionButtonSaved]}
                            onPress={handleToggleFavorite}
                            activeOpacity={0.8}
                            disabled={loadingFavorite}
                        >
                            {loadingFavorite ? (
                                <ActivityIndicator size="small" color={isSaved ? "#fff" : "#E50914"} />
                            ) : (
                                <>
                                    <Bookmark 
                                        color={isSaved ? "#fff" : "#E50914"} 
                                        fill={isSaved ? "#fff" : "transparent"} 
                                        size={20} 
                                    />
                                    <Text style={[styles.favoriteActionText, isSaved && styles.favoriteActionTextSaved]}>
                                        {isSaved ? "Favorilerden Çıkar" : "Favorilere Ekle"}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {movie.trailerUrl ? (
                            <TouchableOpacity
                                style={styles.trailerButton}
                                onPress={() => Linking.openURL(movie.trailerUrl!)}
                                activeOpacity={0.8}
                            >
                                <PlayCircle color="#fff" size={20} />
                                <Text style={styles.trailerText}>Fragmanı İzle</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    imageContainer: { width: '100%', height: 450, position: 'relative' },
    poster: { width: '100%', height: '100%' },
    headerActions: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 },
    iconButton: { backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 22, minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
    iconButtonSaved: { backgroundColor: 'rgba(229,9,20,0.2)', borderWidth: 1, borderColor: '#E50914' },
    content: { padding: 20, marginTop: -20, backgroundColor: '#000', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#fff', flex: 1, marginRight: 10 },
    ratingBadge: { flexDirection: 'row', backgroundColor: '#222', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, alignItems: 'center' },
    ratingText: { color: '#FFD700', fontWeight: 'bold', marginLeft: 6, fontSize: 16 },
    infoText: { color: '#bbb', fontSize: 14, marginBottom: 8, lineHeight: 20 },
    bold: { color: '#E50914', fontWeight: 'bold' },
    sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
    summary: { color: '#999', fontSize: 15, lineHeight: 24 },
    actionsContainer: { flexDirection: 'row', gap: 12, marginTop: 30 },
    favoriteActionButton: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#1E1E1E',
        borderWidth: 1.5,
        borderColor: '#E50914',
        paddingVertical: 14,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    favoriteActionButtonSaved: {
        backgroundColor: '#E50914',
        borderColor: '#E50914',
    },
    favoriteActionText: {
        color: '#E50914',
        fontSize: 15,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    favoriteActionTextSaved: {
        color: '#fff',
    },
    trailerButton: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#333',
        paddingVertical: 14,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    trailerText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
        marginLeft: 8,
    }
});

export default MovieDetail;