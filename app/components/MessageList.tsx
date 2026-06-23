'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Message {
  id: string;
  sender_id: string;
  body: string;
  file_url: string | null;
  extension: string | null;
  payload: any;
  sent_at: string;
  read_at: string | null;
}

interface MessageListProps {
  applicationId: string;
  currentUserId: string;
}

function FileLink({ filePath, fileName, isMine }: { filePath: string; fileName: string; isMine: boolean }) {
  const url = supabase.storage.from('message-attachments').getPublicUrl(filePath).data.publicUrl;
  const cls = isMine ? 'text-xs mt-2 underline block text-blue-100' : 'text-xs mt-2 underline block text-blue-500';
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={cls}>
      {'📎 ' + fileName}
    </a>
  );
}

export const MessageList = ({ applicationId, currentUserId }: MessageListProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    fetchMessages();
    const subscription = supabase
      .channel('messages-' + applicationId)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: 'application_id=eq.' + applicationId },
        (payload) => { setMessages(prev => [...prev, payload.new as Message]); }
      )
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, [applicationId]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('application_id', applicationId)
        .order('sent_at', { ascending: true });
      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('メッセージ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center">読み込み中...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500">メッセージはまだありません</div>
      ) : (
        messages.map((msg) => {
          const isMine = msg.sender_id === currentUserId;
          const wrapCls = isMine ? 'flex justify-end' : 'flex justify-start';
          const bubbleCls = isMine
            ? 'max-w-xs px-4 py-2 rounded-lg bg-blue-500 text-white'
            : 'max-w-xs px-4 py-2 rounded-lg bg-white text-gray-800 border border-gray-200';
          const timeCls = isMine ? 'text-xs mt-1 text-blue-100' : 'text-xs mt-1 text-gray-500';
          const fileName = msg.payload?.fileName || 'ファイル';
          return (
            <div key={msg.id} className={wrapCls}>
              <div className={bubbleCls}>
                <p className="text-sm">{msg.body}</p>
                {msg.file_url ? <FileLink filePath={msg.file_url} fileName={fileName} isMine={isMine} /> : null}
                <p className={timeCls}>{new Date(msg.sent_at).toLocaleTimeString('ja-JP')}</p>
              </div>
            </div>
          );
        })
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};
