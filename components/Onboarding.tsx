// components/Onboarding.tsx
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bot, Compass, Mic } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Kişisel Film Asistanın',
        description: 'Ne izleyeceğine karar veremiyor musun? Ruh halini veya istediğin konuyu yaz, yapay zeka sana en uygun filmleri önersin.',
        icon: Bot
    },
    {
        id: '2',
        title: 'Sesinle Komut Ver',
        description: 'Yazmakla uğraşma. "Bana ters köşe yapan bir gerilim filmi bul" diyerek sesli asistanı kullanmaya başla.',
        icon: Mic
    },
    {
        id: '3',
        title: 'Trendleri Keşfet',
        description: 'Vizyondaki filmleri, popüler yapımları ve en çok oy alan klasikleri tek tıkla keşfet, listene ekle.',
        icon: Compass
    }
];

const Onboarding = ({ onFinish }: { onFinish: () => void }) => {
    const insets = useSafeAreaInsets();
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollX = useRef(new Animated.Value(0)).current;
    const slidesRef = useRef<FlatList>(null);

    const viewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems[0]) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    const scrollToNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            onFinish();
        }
    };

    const renderItem = ({ item }: { item: typeof SLIDES[0] }) => {
        const Icon = item.icon;
        return (
            <View style={[styles.slide, { width }]}>
                <View style={styles.iconContainer}>
                    <Icon size={100} color="#E50914" strokeWidth={1.5} />
                </View>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.description}>{item.description}</Text>
            </View>
        );
    };

    const Paginator = () => (
        <View style={styles.paginatorContainer}>
            {SLIDES.map((_, i) => {
                const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
                const dotWidth = scrollX.interpolate({
                    inputRange,
                    outputRange: [10, 20, 10],
                    extrapolate: 'clamp',
                });
                const opacity = scrollX.interpolate({
                    inputRange,
                    outputRange: [0.3, 1, 0.3],
                    extrapolate: 'clamp',
                });
                return (
                    <Animated.View key={i.toString()} style={[styles.dot, { width: dotWidth, opacity }]} />
                );
            })}
        </View>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <FlatList
                data={SLIDES}
                renderItem={renderItem}
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                bounces={false}
                keyExtractor={(item) => item.id}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
                    useNativeDriver: false,
                })}
                onViewableItemsChanged={viewableItemsChanged}
                viewabilityConfig={viewConfig}
                ref={slidesRef}
            />
            <View style={styles.footer}>
                <Paginator />
                <TouchableOpacity style={styles.button} activeOpacity={0.8} onPress={scrollToNext}>
                    <Text style={styles.buttonText}>
                        {currentIndex === SLIDES.length - 1 ? 'Başla' : 'İleri'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
    slide: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
    iconContainer: { marginBottom: 40, padding: 30, backgroundColor: '#1A1A1A', borderRadius: 100, borderWidth: 1, borderColor: '#333' },
    title: { fontWeight: 'bold', fontSize: 28, color: '#fff', marginBottom: 15, textAlign: 'center' },
    description: { fontWeight: '400', color: '#999', fontSize: 16, textAlign: 'center', paddingHorizontal: 20, lineHeight: 24 },
    footer: { position: 'absolute', bottom: 50, width: '100%', alignItems: 'center' },
    paginatorContainer: { flexDirection: 'row', height: 40 },
    dot: { height: 10, borderRadius: 5, backgroundColor: '#E50914', marginHorizontal: 8 },
    button: { backgroundColor: '#E50914', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30, width: '80%', alignItems: 'center' },
    buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});

export default Onboarding;