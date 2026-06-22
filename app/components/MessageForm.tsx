'use client';

import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface MessageFormProps {
  applicationId: string;
  senderId: string;
  onMessageSent: () => void;
}

export const MessageForm = ({ applicationId, senderId, onMessageSent }: MessageFormProps) => {
  const [message, setMessage] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async () => {
    if (!message.trim() && !attachment) return;

    setUploading(true);
    try {
      let fileUrl: string | null = null;
      let bodyText = message.trim();

      if (attachment) {
        const timestamp = Date.now();
        const filePath = applicationId + '/' + timestamp + '-' + attachment.name;
        const { data, error } = await supabase.storage
          .from('message_attachments')
          .upload(filePath, attachment);
        if (error) throw error;
        fileUrl = data.path;
        if (!bodyText) bodyText = '📎 ' + attachment.name;
      }

      const insertData: any = {
        application_id: applicationId,
        sender_id: senderId,
        body: bodyText,
        topic: 'message',
      };
      if (fileUrl) insertData.file_url = fileUrl;

      const { error: msgError } = await supabase.from('messages').insert(insertData);
      if (msgError) throw msgError;

      setMessage('');
      removeAttachment();
      onMessageSent();
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      alert('メッセージの送信に失敗しました');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="border-t p-4 bg-white">
      {attachment && (
        <div className="mb-3 p-3 bg-gray-50 rounded border flex items-center justify-between text-sm">
          <span className="text-gray-600">📎 {attachment.name}</span>
          <button onClick={removeAttachment} className="text-red-500 hover:text-red-700" type="button">
            削除
          </button>
        </div>
      )}
      <div className="flex gap-2 items-end">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="メッセージを入力..."
          className="flex-1 p-2 border rounded text-sm resize-none"
          rows={3}
          disabled={uploading}
        />
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm font-medium disabled:opacity-50"
            disabled={uploading || attachment !== null}
            type="button"
          >
            📎
          </button>
          <button
            onClick={handleSendMessage}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-medium disabled:opacity-50"
            disabled={uploading || (!message.trim() && !attachment)}
            type="button"
          >
            {uploading ? '...' : '送信'}
          </button>
        </div>
      </div>
    </div>
  );
};
