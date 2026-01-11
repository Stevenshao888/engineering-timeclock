import { Session } from '@supabase/supabase-js';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import LoginScreen from '../../src/screens/LoginScreen';
import PunchScreen from '../../src/screens/PunchScreen';
import { supabase } from '../../src/services/supabase';

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {session && session.user ? <PunchScreen /> : <LoginScreen />}
    </View>
  );
}