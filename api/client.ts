// api/client.ts
import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const getBaseUrl = () => {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
        const ip = hostUri.split(':')[0];
        return `https://movierag-api.onrender.com`;
    }
    return `https://movierag-api.onrender.com`;
};
""
export const api = axios.create({
    baseURL: getBaseUrl(),
    timeout: 6000000,
});

// Her istekte otomatik olarak token'ı ekleyen interceptor
api.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync('user_token');
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});