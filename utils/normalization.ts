// utils/normalization.ts
export interface Movie {
    id: string;
    title: string;
    director: string;
    cast: string;
    genres: string[];
    posterUrl: string;
    rating: string;
    summary: string;
    trailerUrl?: string;
}

export const normalizeMovie = (raw: any): Movie => {
    if (!raw) raw = {};
    return {
        id: String(raw.movie_id || raw.id || raw.Film || raw.title || ''),
        title: raw.Film || raw.title || 'Bilinmeyen Film',
        director: raw.Director || raw.Yönetmen || raw.director || 'Bilinmiyor',
        cast: raw.Cast || raw.Oyuncular || raw.cast || raw.cast_members || 'Bilinmiyor',
        genres: raw.Türler || raw['Tür(ler)'] || raw.genres || [],
        posterUrl: raw.Poster || raw.poster_url || raw.posterUrl || raw.poster || 'https://via.placeholder.com/500x750?text=No+Poster',
        rating: String(raw.IMDb || raw['IMDb ★'] || raw.imdb_rating || raw.rating || 'N/A'),
        summary: raw.Özet || raw['Kısa Özet'] || raw.overview || raw.summary || '',
        trailerUrl: raw.Fragman || raw.trailer_url || raw.trailerUrl,
    };
};