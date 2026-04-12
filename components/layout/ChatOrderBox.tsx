"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth";
import { 
    Send, MessageSquare, X, Minus, Maximize2, 
    AtSign, Bell, User as UserIcon, Search, Smile, Paperclip
} from "lucide-react";

type Message = {
    id: number;
    user_id: string;
    content: string;
    mentions: string[];
    created_at: string;
    user?: {
        name: string;
        avatar: string;
    };
};

export default function ChatOrderBox({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const { user } = useAuth();
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);
    const [users, setUsers] = useState<{id: string, name: string}[]>([]);
    const [mentionSearch, setMentionSearch] = useState("");
    const [showMentions, setShowMentions] = useState(false);
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // 1. Fetch Users untuk Autocomplete Mention
    useEffect(() => {
        const fetchUsers = async () => {
            const { data } = await supabase.from("app_users").select("id, name");
            if (data) setUsers(data);
        };
        fetchUsers();
    }, []);

    // 2. Fetch Initial Messages
    const fetchMessages = useCallback(async () => {
        const { data, error } = await supabase
            .from("internal_notes")
            .select(`
                *,
                user:app_users(name, avatar)
            `)
            .order("created_at", { ascending: false })
            .limit(50);

        if (data) setMessages(data.reverse());
    }, []);

    useEffect(() => {
        fetchMessages();

        // 3. Realtime Subscription
        const channel = supabase
            .channel("internal_chat")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "internal_notes" },
                async (payload) => {
                    const { data: newMessage } = await supabase
                        .from("internal_notes")
                        .select(`*, user:app_users(name, avatar)`)
                        .eq("id", payload.new.id)
                        .single();

                    if (newMessage) {
                        setMessages((prev) => [...prev, newMessage]);
                        
                        // Audio & Unread if not open
                        if (!isOpen || isMinimized) {
                            setUnreadCount((c) => c + 1);
                            if (audioRef.current) {
                                audioRef.current.play().catch(() => {});
                            }
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchMessages, isOpen, isMinimized]);

    // Scroll to bottom on new message
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen, isMinimized]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        const msgContent = input.trim();
        if (!msgContent || !user) return;

        // Detect mentions
        const mentions = users
            .filter(u => msgContent.includes(`@${u.name}`))
            .map(u => u.id);

        try {
            const { error } = await supabase.from("internal_notes").insert({
                user_id: user.id,
                content: msgContent,
                mentions: mentions
            });

            if (error) {
                console.error("Gagal mengirim pesan:", error);
                alert("Gagal mengirim pesan: " + error.message);
            } else {
                setInput("");
                // Opsional: fetch ulang jika realtime belum/lambat aktif
                fetchMessages(); 
            }
        } catch (err) {
            console.error("Error dlm pengiriman:", err);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInput(val);

        const lastWord = val.split(" ").pop() || "";
        if (lastWord.startsWith("@")) {
            setMentionSearch(lastWord.slice(1));
            setShowMentions(true);
        } else {
            setShowMentions(false);
        }
    };

    const insertMention = (name: string) => {
        const words = input.split(" ");
        words.pop(); // remove the @part
        const newInput = [...words, `@${name} `].join(" ");
        setInput(newInput);
        setShowMentions(false);
    };

    if (!user || !isOpen) return null;

    return (
        <>
            <audio ref={audioRef} src="/notify.mp3" preload="auto" />
            
            {/* The Masterpiece Toto Chat Window */}
            <div 
                className={`fixed right-6 z-[9999] flex flex-col bg-white shadow-[0_20px_60px_rgba(0,0,0,0.12)] border border-slate-100 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden ${
                    isMinimized 
                    ? "bottom-6 w-72 h-16 rounded-2xl scale-95 opacity-90 shadow-lg" 
                    : "bottom-6 w-[360px] md:w-[420px] h-[75vh] max-h-[650px] rounded-3xl ring-1 ring-slate-100"
                }`}
            >
                {/* Header - Fixed & Premium */}
                <div 
                    className="flex-none flex items-center justify-between px-5 h-16 bg-white border-b border-slate-50 cursor-pointer select-none sticky top-0 z-10"
                    onClick={() => isMinimized && setIsMinimized(false)}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#5C4033] flex items-center justify-center text-white shadow-sm shadow-[#5C4033]/20">
                            <MessageSquare size={20} strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[14px] font-bold text-slate-800 leading-none">Koordinasi Tim</span>
                            {!isMinimized && (
                                <div className="flex items-center gap-1.5 mt-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                                    <span className="text-[10px] font-medium text-slate-400">Aktif Sekarang</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {!isMinimized && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }} 
                                className="p-2.5 hover:bg-slate-50 rounded-lg text-slate-400 transition-all hover:text-slate-600"
                            >
                                <Minus size={20} />
                            </button>
                        )}
                        <button 
                            onClick={(e) => { e.stopPropagation(); onClose(); }} 
                            className="p-2.5 hover:bg-slate-50 rounded-lg text-slate-400 transition-all hover:text-slate-600"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {!isMinimized && (
                    <>
                        {/* Messages Area - HARD MARGINS (PX-10) */}
                        <div 
                            ref={scrollRef} 
                            className="flex-1 overflow-y-auto px-6 py-6 bg-white scrollbar-hide"
                        >
                            {messages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                                    <MessageSquare size={48} className="mb-4 text-slate-200" strokeWidth={1} />
                                    <p className="text-[12px] font-semibold text-slate-400 tracking-wider">Mulai Koordinasi</p>
                                </div>
                            )}

                            {messages.length > 0 && (
                                <div className="flex items-center justify-center my-6">
                                    <div className="h-[1px] flex-1 bg-slate-50" />
                                    <span className="px-4 text-[11px] font-bold text-slate-300 uppercase tracking-[0.2em]">Hari Ini</span>
                                    <div className="h-[1px] flex-1 bg-slate-50" />
                                </div>
                            )}
                            
                            {messages.map((msg, index) => {
                                const isMe = msg.user_id === user.id;
                                const isFollowUp = index > 0 && messages[index-1].user_id === msg.user_id;
                                const isLastInGroup = index === messages.length - 1 || messages[index+1].user_id !== msg.user_id;
                                
                                return (
                                    <div key={msg.id} className={`flex gap-4 ${isMe ? "flex-row-reverse" : "flex-row"} ${isFollowUp ? "mt-12" : "mt-24"}`}>
                                        {/* Avatar Column - Align to bottom of group */}
                                        <div className="flex-none w-8 flex flex-col justify-end">
                                            {isLastInGroup ? (
                                                <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 border border-slate-50 shadow-sm flex items-center justify-center text-[11px] font-bold text-slate-400">
                                                    {msg.user?.avatar ? (
                                                        <img src={msg.user.avatar} alt={msg.user.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        msg.user?.name?.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                            ) : null}
                                        </div>

                                        <div className={`flex flex-col max-w-[80%] ${isMe ? "items-end" : "items-start"}`}>
                                            <div className={`group relative px-4 py-2.5 transition-all ${
                                                isMe 
                                                ? `bg-[#FDF3E7] text-slate-700 border border-[#A67B5B]/20 ${isFollowUp ? "rounded-[18px]" : "rounded-[18px] rounded-tr-[4px]"}` 
                                                : `bg-white text-slate-700 border border-slate-100 ${isFollowUp ? "rounded-[18px]" : "rounded-[18px] rounded-tl-[4px]"}`
                                            }`}>
                                                <div className="text-[13px] font-medium leading-relaxed">
                                                    {msg.content.split(/(@\w+)/g).map((part, i) => 
                                                        part.startsWith("@") ? (
                                                            <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-[#5C4033]/10 text-[#5C4033] font-bold mx-0.5">
                                                                {part}
                                                            </span>
                                                        ) : part
                                                    )}
                                                </div>
                                                
                                                {/* Tooltip Timestamp */}
                                                <div className={`opacity-0 group-hover:opacity-100 transition-opacity absolute top-1/2 -translate-y-1/2 whitespace-nowrap px-2 py-1 bg-slate-800 text-white text-[9px] font-bold rounded-md pointer-events-none z-50 ${isMe ? "right-full mr-3" : "left-full ml-3"}`}>
                                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                            {isLastInGroup && (
                                                <span className="mt-1.5 px-1 text-[9px] font-bold text-slate-300 uppercase tracking-tight">
                                                    {isMe ? "SAYA" : msg.user?.name?.split(' ')[0]} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Mentions Suggestion Popover */}
                        {showMentions && (
                            <div className="mx-6 mb-4 bg-white/90 backdrop-blur-xl border border-[#E8DCCF] rounded-2xl shadow-2xl overflow-hidden animate-slide-up z-20">
                                <div className="px-4 py-2 border-b border-[#F5EBDD] bg-[#FDF3E7]/50">
                                    <span className="text-[9px] font-bold text-[#A67B5B] uppercase tracking-widest">Saran Koordinasi</span>
                                </div>
                                {users.filter(u => u.name.toLowerCase().includes(mentionSearch.toLowerCase())).map(u => (
                                    <button 
                                        key={u.id}
                                        onClick={() => insertMention(u.name)}
                                        className="w-full text-left px-5 py-3 text-xs font-bold text-[#5C4033] hover:bg-[#A67B5B]/10 transition-colors border-b border-[#F5EBDD]/50 last:border-0 flex items-center gap-3 group"
                                    >
                                        <div className="w-6 h-6 rounded-full bg-[#A67B5B]/20 flex items-center justify-center text-[10px] group-hover:bg-[#A67B5B] group-hover:text-white transition-colors">
                                            {u.name.charAt(0)}
                                        </div>
                                        <span>@{u.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Footer - Minimalist Halo Input Section */}
                        <div className="flex-none px-6 py-5 bg-white border-t border-slate-50">
                            <form onSubmit={handleSend} className="relative flex items-center gap-4">
                                <div className="relative flex-1">
                                    <input 
                                        type="text" 
                                        value={input}
                                        onChange={handleInputChange}
                                        placeholder="Tulis pesan koordinasi..."
                                        className="w-full bg-slate-50 rounded-xl px-4 py-3 text-[14px] font-medium text-slate-700 placeholder:text-slate-300 transition-all outline-none border-none focus:ring-1 focus:ring-slate-100 text-center"
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <button type="button" className="text-slate-300 hover:text-slate-400 transition-colors">
                                        <Paperclip size={20} />
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={!input.trim()}
                                        className="w-10 h-10 bg-[#5C4033] text-white rounded-full flex items-center justify-center shadow-md shadow-[#5C4033]/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-20 disabled:grayscale disabled:scale-100"
                                    >
                                        <Send size={18} className="translate-x-0.5" />
                                    </button>
                                </div>
                            </form>
                        </div>
                    </>
                )}
            </div>
            
            {/* Audio notification for new messages */}
            <audio ref={audioRef} preload="auto" className="hidden">
                <source src="/notification.mp3" type="audio/mpeg" />
            </audio>
        </>
    );
}
