// components/Card.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Star, PlayCircle, Bookmark } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import { normalizeMovie } from '../utils/normalization';

const MovieCard = ({ movie: rawMovie, savedIds = [], onToggle }: { movie: any, savedIds?: string[], onToggle?: () => void }) => {
  const navigation = useNavigation<any>();
  const movie = normalizeMovie(rawMovie);
  const isSaved = savedIds.includes(movie.id);

  const handleToggleFavorite = async () => {
    try {
      if (isSaved) {
        await api.delete(`/favorites/${encodeURIComponent(movie.id)}`);
      } else {
        const payload = {
          movie_id: movie.id,
          title: movie.title,
          genres: movie.genres,
          director: movie.director,
          cast_members: movie.cast,
          poster_url: movie.posterUrl,
          imdb_rating: movie.rating,
          trailer_url: movie.trailerUrl
        };
        await api.post(`/favorites`, payload);
      }
      if (onToggle) onToggle();
    } catch (error) {
      console.error("Favori işlemi hatası:", error);
      Alert.alert("Hata", "Favori işlemi gerçekleştirilemedi.");
    }
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.imageContainer}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('MovieDetail', { movie, savedIds, onToggle, isSaved })}
      >
        {/* contentFit="cover" kalsa bile container yüksekliğini artırdığımız için resim daha iyi görünecek. 
            Eğer resmin tamamını, yanlardan boşluk kalsa bile görmek istersen contentFit="contain" yapabilirsin. */}
        <Image
          source={{ uri: movie.posterUrl }}
          style={styles.poster}
          contentFit="cover"
          transition={300}
          cachePolicy="memory-disk"
        />
        <TouchableOpacity style={styles.saveIconContainer} onPress={handleToggleFavorite}>
          <Bookmark size={24} color={isSaved ? "#E50914" : "#fff"} fill={isSaved ? "#E50914" : "transparent"} />
        </TouchableOpacity>
      </TouchableOpacity>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>{movie.title}</Text>
          <View style={styles.ratingBadge}>
            <Star size={14} color="#FFD700" fill="#FFD700" />
            <Text style={styles.ratingText}>{movie.rating}</Text>
          </View>
        </View>
        <Text style={styles.infoText}><Text style={styles.boldLabel}>Yönetmen:</Text> {movie.director}</Text>
        <Text style={styles.infoText} numberOfLines={1}><Text style={styles.boldLabel}>Oyuncular:</Text> {movie.cast}</Text>
        {/* Sohbet ekranında çok fazla yer kaplamaması için özet satır sayısını 2 ile sınırlandırdık */}
        <Text style={styles.summary} numberOfLines={2}>{movie.summary}</Text>
        <View style={styles.footer}>
          <TouchableOpacity style={styles.trailerButton} onPress={() => movie.trailerUrl && Linking.openURL(movie.trailerUrl)}>
            <PlayCircle size={18} color="#fff" /><Text style={styles.trailerButtonText}>Fragman</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: '#1A1A1A', borderRadius: 15, marginBottom: 20, overflow: 'hidden', borderWidth: 0.5, borderColor: '#333' },
  // DÜZELTME: Yükseklik (height) 180'den 240'a (veya 300'e) çıkarıldı.
  // Film posterleri genelde diktörgen olduğu için bu oran (örn: width %100, height 300) daha doğru bir kırpma sağlar.
  imageContainer: { position: 'relative', width: '100%', height: 280, backgroundColor: '#111' },
  poster: { width: '100%', height: '100%' },
  saveIconContainer: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },
  content: { padding: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  title: { color: '#fff', fontSize: 18, fontWeight: 'bold', flex: 1 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#333', padding: 4, borderRadius: 6 },
  ratingText: { color: '#FFD700', marginLeft: 4, fontWeight: 'bold' },
  infoText: { color: '#BBB', fontSize: 13, marginBottom: 2 },
  boldLabel: { color: '#E50914', fontWeight: 'bold' },
  summary: { color: '#999', fontSize: 13, marginTop: 8 },
  footer: { marginTop: 12, alignItems: 'flex-end' },
  trailerButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E50914', padding: 8, borderRadius: 20 },
  trailerButtonText: { color: '#fff', fontWeight: 'bold', marginLeft: 5, fontSize: 12 }
});

export default MovieCard;