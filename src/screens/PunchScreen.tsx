import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../services/supabase';
import { calculateDistance } from '../utils/location';

export default function PunchScreen() {
    // 1. State Definitions
    const [loading, setLoading] = useState(true);
    const [statusMsg, setStatusMsg] = useState('定位中...');
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [workSite, setWorkSite] = useState<{ lat: number; long: number; name: string } | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [isWithinRange, setIsWithinRange] = useState(false);
    const [activeLogId, setActiveLogId] = useState<string | null>(null);

    // 2. Initial Load
    useEffect(() => {
        checkUserStatus();
    }, []);

    // 3. User & Site Status Check
    const checkUserStatus = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (user && user.email) {
                const id = user.email.split('@')[0];
                setUserEmail(id);

                // Check for active punch
                const todayValues = new Date();
                todayValues.setHours(0, 0, 0, 0);
                const { data: logs } = await supabase
                    .from('attendance_logs')
                    .select('id')
                    .eq('user_id', user.id)
                    .is('check_out_time', null)
                    .gte('check_in_time', todayValues.toISOString())
                    .limit(1);

                if (logs && logs.length > 0) setActiveLogId(logs[0].id);
                else setActiveLogId(null);

                // Fetch Work Site (Dynamic Assignment)
                let siteData = null;
                let targetSiteId = null;

                // 1. Get User's Assigned Site ID from Profile
                const { data: profile } = await supabase.from('profiles').select('default_site_id').eq('id', user.id).single();
                if (profile && profile.default_site_id) {
                    targetSiteId = profile.default_site_id;
                }

                // 2. Fetch the Site Data
                if (targetSiteId) {
                    // Scenario A: User has specific assignment
                    const { data: site } = await supabase.from('work_sites').select('*').eq('id', targetSiteId).single();
                    if (site) siteData = site;
                }

                // 3. Fallback: If no assignment or assignment invalid, get the FIRST available site
                if (!siteData) {
                    const { data: firstSite } = await supabase.from('work_sites').select('*').limit(1).single();
                    siteData = firstSite;
                }

                // 4. Update State
                if (siteData) {
                    setWorkSite({ lat: siteData.latitude, long: siteData.longitude, name: siteData.name });
                } else {
                    // Absolute Fail-safe
                    setWorkSite({ lat: 22.645, long: 120.306, name: '總部 (預設)' });
                }
            }

            // Fetch Location Logic
            await fetchLocationSafe();

        } catch (error) {
            console.error('Init Error:', error);
            setStatusMsg('初始化錯誤');
            setLoading(false);
        }
    };

    // 4. Robust Location Fetching (Promise.race)
    const fetchLocationSafe = async () => {
        try {
            setLoading(true);
            setStatusMsg('正在獲取位置資訊...');

            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setStatusMsg('缺少 GPS 權限');
                setLoading(false);
                return;
            }

            // Race Condition: 5s Timeout vs GPS
            const getLocationPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('GPS Timeout')), 5000)
            );

            const loc = await Promise.race([getLocationPromise, timeoutPromise]) as Location.LocationObject;

            // Success
            setLocation(loc);
            setStatusMsg('定位完成');

        } catch (error) {
            console.log('GPS Failed/Timeout, switching to Indoor Mode');

            // Indoor/Mock Mode
            Alert.alert('無法定位', '已切換至「室內測試模式」(Mock Location)');
            const mockLoc: Location.LocationObject = {
                coords: {
                    latitude: 22.645,
                    longitude: 120.306,
                    altitude: 0,
                    accuracy: 10,
                    altitudeAccuracy: 5,
                    heading: 0,
                    speed: 0
                },
                timestamp: Date.now()
            };
            setLocation(mockLoc);
            setDistance(0); // Force distance 0 for mock
            setIsWithinRange(true);
            setStatusMsg('室內測試模式');
        } finally {
            setLoading(false);
        }
    };

    // 5. Distance Recalculation
    useEffect(() => {
        if (location && workSite) {
            const dist = calculateDistance(
                location.coords.latitude,
                location.coords.longitude,
                workSite.lat,
                workSite.long
            );
            setDistance(dist);
            setIsWithinRange(dist <= 200);
        }
    }, [location, workSite]);

    // 6. Punch Action
    const handlePunch = async () => {
        if (!location) {
            Alert.alert('錯誤', '等待定位中...');
            return;
        }
        // Geofence check removed: Allow punching anywhere
        // if (workSite && !isWithinRange) { ... }

        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not found');

            const payload = {
                gps_lat: location.coords.latitude,
                gps_long: location.coords.longitude,
                in_latitude: !activeLogId ? location.coords.latitude : undefined, // Only for In
                in_longitude: !activeLogId ? location.coords.longitude : undefined,
                out_latitude: activeLogId ? location.coords.latitude : undefined, // Only for Out
                out_longitude: activeLogId ? location.coords.longitude : undefined,
            };

            if (activeLogId) {
                // Punch Out
                const { error } = await supabase
                    .from('attendance_logs')
                    .update({
                        check_out_time: new Date().toISOString(),
                        ...payload
                    })
                    .eq('id', activeLogId);
                if (error) throw error;
                Alert.alert('成功', '下班打卡成功!');
                setActiveLogId(null);
            } else {
                // Punch In
                const { data, error } = await supabase
                    .from('attendance_logs')
                    .insert([{
                        user_id: user.id,
                        check_in_time: new Date().toISOString(),
                        status: isWithinRange ? 'regular' : 'late',
                        ...payload
                    }])
                    .select();
                if (error) throw error;
                if (data) setActiveLogId(data[0].id);
                Alert.alert('成功', '上班打卡成功!');
            }
        } catch (e: any) {
            Alert.alert('錯誤', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.brandText}>👷 和芳工程行</Text>
                </View>
                <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
                    <Text style={styles.signOutText}>登出</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.contentContainer}>
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color="#F1C40F" />
                        <Text style={styles.statusText}>{statusMsg}</Text>
                    </View>
                ) : (
                    <View style={styles.center}>
                        {/* Digital Meter Card */}
                        <View style={styles.meterCard}>
                            <Text style={styles.meterLabel}>DISTANCE TO SITE / 距離</Text>

                            {workSite && distance !== null ? (
                                <Text style={[
                                    styles.meterValue,
                                    { color: isWithinRange ? '#2ECC71' : '#E74C3C' }
                                ]}>
                                    {distance.toFixed(0)} <Text style={styles.meterUnit}>M</Text>
                                </Text>
                            ) : (
                                <Text style={styles.meterPlaceholder}>---</Text>
                            )}

                            <Text style={styles.siteLabel}>
                                {workSite ? `📍 目標：${workSite.name}` : '尋找工區中...'}
                            </Text>
                        </View>

                        {/* Physical Machine Button */}
                        <TouchableOpacity
                            style={[
                                styles.machineBtn,
                                activeLogId ? styles.machineBtnOut : styles.machineBtnIn,
                                // (workSite && !isWithinRange) && styles.machineBtnDisabled // Removed disabled style
                            ]}
                            onPress={handlePunch}
                            disabled={false} // Always enabled
                            activeOpacity={0.7}
                        >
                            <Text style={styles.machineBtnText}>
                                {activeLogId ? '下班打卡\nSTOP WORK' : '上班打卡\nSTART WORK'}
                            </Text>
                        </TouchableOpacity>

                        {/* Refresh Button */}
                        <TouchableOpacity onPress={fetchLocationSafe} style={styles.refreshBtn}>
                            <Text style={styles.refreshText}>🔄 GPS 校準 / CALIBRATE</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>ID: {userEmail}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212', // Deep Dark
    },
    header: {
        width: '100%',
        height: 120,             // Taller header
        paddingTop: 60,          // Pushes content below status bar
        backgroundColor: '#1E1E1E',
        flexDirection: 'row',
        justifyContent: 'center', // Center the title
        alignItems: 'center',
        borderBottomWidth: 3,
        borderBottomColor: '#F1C40F',
        elevation: 5,            // Shadow for Android
    },
    brandText: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#F1C40F',
        marginBottom: 10,       // Breathing room from bottom border
    },
    signOutBtn: {
        position: 'absolute',
        right: 20,
        top: 65,                // Aligned with the new safe area
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#444',
        borderRadius: 4,
        backgroundColor: '#1E1E1E', // Ensure it covers background if needed
    },
    signOutText: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
    },
    contentContainer: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 30,
        paddingHorizontal: 20,
    },
    center: {
        width: '100%',
        alignItems: 'center',
    },
    statusText: {
        marginTop: 15,
        fontSize: 16,
        color: '#F1C40F',
    },
    // Meter Card
    meterCard: {
        width: '100%',
        backgroundColor: '#1E1E1E',
        padding: 24,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#333',
        alignItems: 'center',
        marginBottom: 40,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    meterLabel: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 10,
        letterSpacing: 1,
    },
    meterValue: {
        fontSize: 56,
        fontWeight: 'bold',
        fontVariant: ['tabular-nums'],
    },
    meterUnit: {
        fontSize: 24,
        color: '#666',
    },
    meterPlaceholder: {
        fontSize: 48,
        color: '#444',
        marginVertical: 10,
    },
    siteLabel: {
        color: '#F1C40F',
        marginTop: 10,
        fontSize: 14,
        fontWeight: 'bold',
    },
    // Machine Button
    machineBtn: {
        width: 240,
        height: 240,
        borderRadius: 20, // Rounded Square
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 10, // Physical depth
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10,
    },
    machineBtnIn: {
        backgroundColor: '#2980B9', // Blue
        borderBottomColor: '#1A5276', // Darker Blue
    },
    machineBtnOut: {
        backgroundColor: '#C0392B', // Red
        borderBottomColor: '#922B21', // Darker Red
    },
    machineBtnDisabled: {
        backgroundColor: '#34495E',
        borderBottomColor: '#212F3D',
        opacity: 0.7,
    },
    machineBtnText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        textAlign: 'center',
        lineHeight: 36,
    },
    // Refresh
    refreshBtn: {
        marginTop: 30,
        borderWidth: 1,
        borderColor: '#F1C40F',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 30,
    },
    refreshText: {
        color: '#F1C40F',
        fontWeight: 'bold',
        fontSize: 14,
    },
    footer: {
        padding: 20,
        alignItems: 'center',
    },
    footerText: {
        color: '#444',
        fontSize: 12,
        fontWeight: 'bold',
    },
});