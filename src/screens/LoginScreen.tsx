import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabase';

export default function LoginScreen() {
    const [employeeId, setEmployeeId] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!employeeId || !password) {
            Alert.alert('錯誤', '請輸入工號和密碼');
            return;
        }

        setLoading(true);
        try {
            const email = `${employeeId}@timeclock.local`;

            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                Alert.alert('登入失敗', error.message);
            }
        } catch (error: any) {
            Alert.alert('登入錯誤', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>和芳工程行</Text>

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="員工編號 / Employee ID"
                    placeholderTextColor="#AAAAAA"
                    value={employeeId}
                    onChangeText={setEmployeeId}
                    autoCapitalize="none"
                    keyboardType="numeric"
                />
            </View>

            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="密碼 / Password"
                    placeholderTextColor="#AAAAAA"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />
            </View>

            <TouchableOpacity
                style={styles.button}
                onPress={handleLogin}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#121212" />
                ) : (
                    <Text style={styles.buttonText}>登入系統 / LOGIN</Text>
                )}
            </TouchableOpacity>

            <View style={{ marginTop: 40, alignItems: 'center' }}>
                <Text style={{ color: '#444', fontSize: 12 }}>HE FANG ENGINEERING SYSTEM</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212', // Deep Dark
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 40,
        color: '#F1C40F', // Construction Yellow
        letterSpacing: 1,
    },
    inputContainer: {
        marginBottom: 15,
    },
    input: {
        height: 50,
        backgroundColor: '#1E1E1E', // Lighter Dark
        color: 'white',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        paddingHorizontal: 15,
        fontSize: 16,
    },
    button: {
        backgroundColor: '#F1C40F', // Construction Yellow
        height: 55,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    buttonText: {
        color: '#121212',
        fontSize: 18,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});
