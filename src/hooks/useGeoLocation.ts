import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export const useGeoLocation = () => {
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setErrorMsg('Permission to access location was denied');
                setLoading(false);
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            setLocation(location);
            setLoading(false);
        })();
    }, []);

    const refreshLocation = async () => {
        setLoading(true);
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
            let { status: newStatus } = await Location.requestForegroundPermissionsAsync();
            if (newStatus !== 'granted') {
                setErrorMsg('Permission to access location was denied');
                setLoading(false);
                return;
            }
        }
        let location = await Location.getCurrentPositionAsync({});
        setLocation(location);
        setLoading(false);
    }

    return { location, errorMsg, loading, refreshLocation };
};
