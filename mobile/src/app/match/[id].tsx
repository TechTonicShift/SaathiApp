import { useEffect } from 'react';
import { Alert, Pressable, Text } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Chat } from '@/components/chat';
import { KeyboardScreen } from '@/components/ui';
import { supabase, rpc } from '@/services/supabase';
import { useAuthStore } from '@/store/auth';
import type { ChatMessage } from '@/types';

export default function MatchChat() {
  const { id, name, otherUserId } = useLocalSearchParams<{ id: string; name?: string; otherUserId?: string }>();
  const uid = useAuthStore((s) => s.user!.id);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['chat', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('Message').select('*').eq('matchId', id)
        .order('createdAt', { ascending: false }).limit(100);
      if (error) throw error;
      return data as ChatMessage[];
    },
  });

  // Realtime respects RLS, so only the two members receive new rows.
  useEffect(() => {
    const c = supabase.channel('match:' + id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Message', filter: 'matchId=eq.' + id },
        () => qc.invalidateQueries({ queryKey: ['chat', id] }))
      .subscribe();
    return () => { supabase.removeChannel(c); };
  }, [id]);

  async function send(body: string) {
    const { error } = await supabase.from('Message').insert({
      matchId: id, senderId: uid, body,
      clientId: Date.now().toString(36) + Math.random().toString(36).slice(2),
    });
    if (error) throw error;
  }

  async function leave() {
    await qc.invalidateQueries({ queryKey: ['matches'] });
    router.replace('/matches');
  }

  function block() {
    if (!otherUserId) return;
    Alert.alert('Block ' + (name ?? 'this person') + '?', 'The chat ends and you will never share a plan again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('UserBlock').insert({ blockerId: uid, blockedId: otherUserId });
        if (error && !error.message.includes('duplicate')) return Alert.alert('Could not block', error.message);
        await leave();
      } },
    ]);
  }

  function menu() {
    Alert.alert(name ?? 'Connection', 'What would you like to do?', [
      { text: 'Report', onPress: () => router.push({ pathname: '/report', params: { matchId: id, subjectUserId: otherUserId } }) },
      { text: 'Block', style: 'destructive', onPress: block },
      { text: 'Unmatch', style: 'destructive', onPress: async () => { await rpc('unmatch', { p_match_id: id }); await leave(); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <KeyboardScreen>
      <Stack.Screen options={{
        title: name ?? 'Chat',
        headerRight: () => (
          <Pressable accessibilityRole="button" accessibilityLabel="Safety options" onPress={menu} hitSlop={12}>
            <Text className="text-2xl text-ink">⋯</Text>
          </Pressable>
        ),
      }} />
      <Chat rows={q.data ?? []} onSend={send} />
    </KeyboardScreen>
  );
}

