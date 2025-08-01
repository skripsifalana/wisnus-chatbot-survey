// src/components/survey/ChatLayout.tsx  

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "@/components/other/ThemeProvider";
import ChatSidebar from "./ChatSidebar";
import ChatHeader from "./ChatHeader";
import ChatScrollButton from "./ChatScrollButton";
import ChatInputArea from "./ChatInputArea";
import ChatMessageArea from "./ChatMessageArea";
import ModeConfirmationPopup from "./ModeConfirmationPopup";
import { queryRAG } from "@/services/survey/ragService";
import { getToken, getUserData, UserData, updateUserProperty } from "@/services/auth";
import { submitResponse } from "@/services/survey/surveyManagement";
import { Question, SurveyMessageRequest, SurveyResponseData } from "@/services/survey/types";
import { addSurveyMessage } from "@/services/survey/surveyMessages";
import { getCurrentQuestion } from "@/services/survey";
import { ChatMessage, formatSurveyResponse } from "@/utils/surveyMessageFormatters";
import { analyzeIntent } from "@/services/survey/intentAnalysis";

interface ChatLayoutProps {
    messages: ChatMessage[];
    addMessage: (message: Partial<ChatMessage> & { text: string; user: boolean; mode: "survey" | "qa" }) => void;
    updateLastMessage: (text: string, user: boolean, customProps?: Partial<ChatMessage>) => void;
    addUserAndSystemMessage: (userMessage: string, systemResponse: SurveyResponseData, mode?: 'survey' | 'qa') => void;
    refreshStatus: () => void;
    refreshAnsweredQuestions: () => void;
    refreshProgressSilent: () => void;
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const ChatLayout: React.FC<ChatLayoutProps> = ({
    messages,
    addMessage,
    updateLastMessage,
    addUserAndSystemMessage,
    refreshStatus,
    refreshAnsweredQuestions,
    refreshProgressSilent,
    setMessages
}) => {
    // State
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [botIsTyping, setBotIsTyping] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [themeMenuOpen, setThemeMenuOpen] = useState(false);
    const [mode, _setMode] = useState<'survey' | 'qa'>("survey");

    // State untuk pertanyaan saat ini
    const [currentQuestion, setCurrentQuestion] = useState<Question | undefined>(undefined);

    // State untuk animasi opsi
    const [animatingMessageId, setAnimatingMessageId] = useState<string | null>(null);
    const [visibleOptions, setVisibleOptions] = useState<Record<string, string[]>>({});

    // State for token animation
    const [animatingText, setAnimatingText] = useState<Record<string, string>>({});
    const [completedText, setCompletedText] = useState<Record<string, string>>({});

    // Mode confirmation popup state
    const [showModePopup, setShowModePopup] = useState(false);
    const qaTimerRef = useRef<NodeJS.Timeout | null>(null);
    const qaTimeoutDuration = 180; // 120 seconds in QA mode before showing popup
    const popupCountdown = 10; // 10 seconds countdown in the popup

    // Ganti nama state untuk toast
    const [qaErrorToast, setQaErrorToast] = useState<{ open: boolean; message: string }>({ open: false, message: "" });

    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Theme
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';

    // Scroll state
    const [userHasScrolled, setUserHasScrolled] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);

    // User scroll reference
    const isUserScrollingRef = useRef(false);

    // Token generation ref for stopping bot typing
    const tokenGenerationRef = useRef<{
        timeouts: NodeJS.Timeout[];
        stopped: boolean;
    }>({
        timeouts: [],
        stopped: false
    });

    // State untuk intercept kesiapan survei
    const [awaitingSurveyReadiness, setAwaitingSurveyReadiness] = useState(false);

    // Helper for async logic on mode switch (must be after animateTokenByToken is defined)
    const setModeAsync = useCallback((newMode: 'survey' | 'qa') => {
      if (newMode === 'survey' && mode !== 'survey') {
        // console.log("messages", messages)
        const lastMsg = messages[messages.length - 1];
        console.log("lastSystemMsg: ", lastMsg);
        // const isQuestion = lastSystemMsg && (lastSystemMsg.questionObject || lastSystemMsg.questionCode);
        // console.log("isQuestion:", isQuestion);
        if (lastMsg.user || (!lastMsg.user && lastMsg.mode == "qa")) {
          getCurrentQuestion().then(response => {
            if (response.success && response.data?.current_question) {
              const q = response.data.current_question;
              
              // Format response untuk auto-injected question
              const systemResponse = {
                info: 'question',
                currentQuestion: q,
                system_message: q.text
              };
              
              const questionMsgId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
              
              // Buat final message dengan custom component properties untuk auto-injected question
              const finalMessage: ChatMessage = {
                id: questionMsgId,
                text: q.text,
                user: false,
                mode: 'survey',
                loading: false,
                questionObject: q,
                questionCode: q.code,
                options: q.options || [],
                customComponent: 'AutoInjectedQuestion',
                responseType: 'auto_injected_question',
                infoText: 'Melanjutkan pertanyaan terakhir. Jawablah pertanyaan berikut ini.',
                questionText: q.text,
                timestamp: new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                read: false
              };
              
              // Tambahkan pesan dengan custom component properties
              setMessages(prevMessages => [...prevMessages, finalMessage]);
              
              // Persist to DB
              addSurveyMessage({
                user_message: null,
                system_response: systemResponse,
                mode: 'survey'
              }).catch((err) => console.error('Failed to persist injected system question:', err));
              animateTokenByToken(questionMsgId, q.text, () => {
                if (q.options?.length) {
                  setVisibleOptions(prev => ({ ...prev, [questionMsgId]: q.options! }));
                }
              });
            }
          });
        }
      }
      _setMode(newMode);
    }, [mode, messages, addMessage, setMessages]);

    // Wrapper to match Dispatch<SetStateAction<'survey' | 'qa'>> signature
    const setModeDispatch: React.Dispatch<React.SetStateAction<'survey' | 'qa'>> = (value) => {
      if (typeof value === 'function') {
        // Not expected in this usage, fallback to previous mode
        _setMode(value);
      } else {
        setModeAsync(value);
      }
    };

    // Fungsi untuk menganimasi opsi jawaban
    const animateOptions = (messageId: string, options: string[]) => {
        if (!options || options.length === 0) return;

        // Set message ini sebagai yang sedang dianimasi
        setAnimatingMessageId(messageId);

        // Mulai dengan array opsi kosong
        setVisibleOptions(prev => ({
            ...prev,
            [messageId]: []
        }));

        // Tambahkan opsi satu per satu
        options.forEach((_, index) => {
            const timeout = setTimeout(() => {
                setVisibleOptions(prev => ({
                    ...prev,
                    [messageId]: options.slice(0, index + 1)
                }));

                // Setelah semua opsi ditampilkan, akhiri animasi
                if (index === options.length - 1) {
                    setTimeout(() => {
                        setAnimatingMessageId(null);
                    }, 300);
                }
            }, 300 * (index + 1));
            tokenGenerationRef.current.timeouts.push(timeout);
        });
    };

    // Handle mode change and set timer for QA mode
    useEffect(() => {
        // Clear any existing timers
        if (qaTimerRef.current) {
            clearTimeout(qaTimerRef.current);
            qaTimerRef.current = null;
        }

        // Set timer if in QA mode
        if (mode === 'qa') {
            qaTimerRef.current = setTimeout(() => {
                setShowModePopup(true);
            }, qaTimeoutDuration * 1000);
        } else {
            setShowModePopup(false);
        }

        // Cleanup on unmount
        return () => {
            if (qaTimerRef.current) {
                clearTimeout(qaTimerRef.current);
            }
        };
    }, [mode]);

    // Auto-scroll when messages change if user hasn't scrolled
    useEffect(() => {
        if (!userHasScrolled && !isUserScrollingRef.current) {
            scrollToBottom();
        }
    }, [messages, userHasScrolled, visibleOptions, animatingText]);

    // Handle scroll detection
    useEffect(() => {
        const chatContainer = chatContainerRef.current;
        const messagesEnd = messagesEndRef.current;
        if (!chatContainer || !messagesEnd) return;

        // Buat Intersection Observer untuk deteksi bottom visibility
        const observer = new IntersectionObserver(
            (entries) => {
                const isBottomVisible = entries[0].isIntersecting;
                setShowScrollButton(!isBottomVisible);
                if (isBottomVisible) {
                    setUserHasScrolled(false);
                }
            },
            {
                root: chatContainer,
                threshold: 1.0,
                rootMargin: "20px"
            }
        );

        // Observe messages end element
        observer.observe(messagesEnd);

        // Cleanup
        return () => {
            observer.disconnect();
        };
    }, []);

    // Handle scroll untuk user interaction tracking
    useEffect(() => {
        const chatContainer = chatContainerRef.current;
        if (!chatContainer) return;

        const handleScroll = () => {
            isUserScrollingRef.current = true;
            setUserHasScrolled(true);

            // Reset scroll flag after user finishes scrolling
            setTimeout(() => {
                isUserScrollingRef.current = false;
            }, 100);
        };

        chatContainer.addEventListener("scroll", handleScroll);
        return () => {
            chatContainer.removeEventListener("scroll", handleScroll);
        };
    }, []);

    // Handle scroll to bottom button click
    const handleScrollToBottom = () => {
        scrollToBottom();
        setUserHasScrolled(false);
        setShowScrollButton(false);
    };

    // Stop token generation
    const stopTokenGeneration = () => {
        // Clear all timeouts
        tokenGenerationRef.current.timeouts.forEach(timeout => clearTimeout(timeout));
        tokenGenerationRef.current.stopped = true;

        // Update animating messages to completed state
        Object.keys(animatingText).forEach(id => {
            if (completedText[id]) {
                updateLastMessage(completedText[id] + " [berhenti mengetik]", false);
            }
        });

        // Reset animation states
        setAnimatingText({});
        setBotIsTyping(false);
    };

    // New function for token-by-token animation
    const animateTokenByToken = (messageId: string, fullText: string, onComplete?: () => void) => {
        if (tokenGenerationRef.current.stopped) return;
        
        // Store the complete text for reference if animation is stopped
        setCompletedText(prev => ({
            ...prev,
            [messageId]: fullText
        }));

        // Set initial empty animation text
        setAnimatingText(prev => ({
            ...prev,
            [messageId]: ""
        }));

        // Set bot is typing state
        setBotIsTyping(true);

        // Calculate a dynamic typing speed based on text length
        // Shorter texts appear faster, longer texts maintain a reasonable overall duration
        const baseDelay = Math.max(20, Math.min(50, 1500 / fullText.length));
        
        // Add each character one by one with a slight delay
        for (let i = 0; i < fullText.length; i++) {
            const timeout = setTimeout(() => {
                if (tokenGenerationRef.current.stopped) return;
                
                const currentText = fullText.substring(0, i + 1);
                setAnimatingText(prev => ({
                    ...prev,
                    [messageId]: currentText
                }));

                // When animation completes
                if (i === fullText.length - 1) {
                    setBotIsTyping(false);
                    // Remove from animating state after a small delay
                    setTimeout(() => {
                        // IMPORTANT: Update the actual message with the final text before removing it from animatingText
                        updateLastMessage(fullText, false);
                        
                        setAnimatingText(prev => {
                            const newState = { ...prev };
                            delete newState[messageId];
                            return newState;
                        });
                        
                        if (onComplete) onComplete();
                    }, 100);
                }
            }, i * baseDelay);

            tokenGenerationRef.current.timeouts.push(timeout);
        }
    };

    // Fungsi untuk beralih dari mode QA ke mode survei
    const handleSwitchToSurvey = async () => {
        // setModeDispatch('survey');
        _setMode('survey');
        setShowModePopup(false);

        // Membersihkan timer mode QA
        if (qaTimerRef.current) {
            clearTimeout(qaTimerRef.current);
            qaTimerRef.current = null;
        }

        try {
            // Mendapatkan pertanyaan saat ini dari API
            const response = await getCurrentQuestion();

            let pesanTeks = "Mode berubah ke survei. Mari lanjutkan survei Anda.";

            if (response.success && response.data) {
                const { status, current_question, message } = response.data;

                if (status === "COMPLETED") {
                    pesanTeks += message || " Survei telah selesai. Terima kasih atas partisipasi Anda.";
                    
                    // Buat ID pesan baru
                    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                    
                    // Tambahkan pesan kosong terlebih dahulu
                    addMessage({
                        id: messageId,
                        text: "",
                        user: false,
                        mode: 'survey',
                        options: []
                    });
                    
                    // Mulai animasi token
                    animateTokenByToken(messageId, pesanTeks);
                } else if (current_question) {
                    pesanTeks += `\n\nPertanyaan saat ini:\n\n${current_question.text}`;

                    // Simpan ke state terlebih dahulu
                    setCurrentQuestion(current_question);
                    
                    // Simpan session_id jika ada dalam response
                    if (response.data.session_id && !getUserData()?.activeSurveySessionId) {
                        console.log("Menyimpan activeSurveySessionId dari handleSwitchToSurvey:", response.data.session_id);
                        updateUserProperty('activeSurveySessionId', response.data.session_id);
                        // Refresh status untuk memuat data survei terbaru (mulus tanpa reload halaman)
                        setTimeout(() => {
                            refreshStatus();
                        }, 100);
                    }

                    // Format response untuk mendapatkan custom component properties
                    const systemResponse = {
                        info: "switched_to_survey",
                        currentQuestion: current_question,
                        additional_info: "Anda telah beralih ke mode survei."
                    };
                    const botResponse = formatSurveyResponse(systemResponse);

                    // Kirim ke database
                    const surveyMessage: SurveyMessageRequest = {
                        user_message: null,
                        system_response: systemResponse,
                        mode: 'survey',
                    };
                    await addSurveyMessage(surveyMessage);

                    // Buat messageId unik
                    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

                    // Buat final message dengan custom component properties
                    const finalMessage: ChatMessage = {
                        id: messageId,
                        text: pesanTeks,
                        user: false,
                        mode: 'survey',
                        loading: false,
                        questionObject: current_question,
                        questionCode: current_question.code,
                        options: [],
                        customComponent: botResponse.customComponent,
                        responseType: botResponse.responseType,
                        infoText: botResponse.infoText,
                        questionText: botResponse.questionText,
                        timestamp: new Date().toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        }),
                        read: false
                    };

                    // Tambahkan pesan dengan custom component properties
                    setMessages(prevMessages => [...prevMessages, finalMessage]);

                    // Animasi token dan kemudian opsi
                    animateTokenByToken(messageId, pesanTeks, () => {
                        if (current_question.options?.length) {
                            animateOptions(messageId, current_question.options);
                        }
                    });
                } else {
                    // Buat ID pesan baru
                    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                    
                    // Tambahkan pesan kosong terlebih dahulu
                    addMessage({
                        id: messageId,
                        text: pesanTeks, 
                        user: false,
                        mode: 'survey',
                        options: []
                    });
                    
                    // Mulai animasi token
                    animateTokenByToken(messageId, pesanTeks + " Mari lanjutkan survei Anda.");
                }
            } else {
                // Buat ID pesan baru
                const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                
                // Tambahkan pesan kosong terlebih dahulu
                addMessage({
                    id: messageId,
                    text: pesanTeks, 
                    user: false,
                    mode: 'survey',
                    options: []
                });
                
                // Mulai animasi token
                animateTokenByToken(messageId, pesanTeks + " Mari lanjutkan survei Anda.");
            }
        } catch (error) {
            console.error("Kesalahan saat mendapatkan pertanyaan saat ini:", error);
            
            // Buat ID pesan baru
            const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            
            // Tambahkan pesan kosong terlebih dahulu
            addMessage({
                id: messageId,
                text: "Mode berubah ke survei. Mari lanjutkan survei Anda.", // CHANGE: Add initial text
                user: false,
                mode: 'survey',
                options: []
            });
            
            // Mulai animasi token
            animateTokenByToken(messageId, "Mode berubah ke survei. Mari lanjutkan survei Anda.");
        }
    };

    // Handle mengirim pesan
    const handleSend = async () => {
        if (!input.trim() || loading || botIsTyping) return;

        const userMessage = input.trim();
        setInput("");

        // Tambahkan pesan pengguna ke daftar pesan (tidak disimpan ke database otomatis)
        addMessage({
            id: `user_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            text: userMessage,
            user: true,
            mode: mode,
            options: []
        });

        setLoading(true);
        setBotIsTyping(true);
        setUserHasScrolled(false);

        // Reset token generation state
        tokenGenerationRef.current = {
            stopped: false,
            timeouts: []
        };

        // Tambahkan pesan loading
        const loadingMsgId = `loading_msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        addMessage({
            id: loadingMsgId,
            text: "",
            user: false,
            loading: true,
            mode: mode,
            options: []
        });

        try {
            // INTERCEPT: intent analysis kesiapan survei
            if (awaitingSurveyReadiness) {
                const intentResult = await analyzeIntent(userMessage);
                if (intentResult.success && intentResult.data?.wants_to_start) {
                    // User siap, ambil pertanyaan pertama
                    updateLastMessage("Terima kasih, kita akan mulai surveinya sekarang!", false);
                    setAwaitingSurveyReadiness(false);
                    // Ambil pertanyaan pertama
                    const response = await getCurrentQuestion();
                    if (response.success && response.data?.current_question) {
                        const q = response.data.current_question;
                        setCurrentQuestion(q);
                        
                        // Simpan session_id jika ada dalam response
                        if (response.data.session_id && !getUserData()?.activeSurveySessionId) {
                            console.log("Menyimpan activeSurveySessionId dari getCurrentQuestion:", response.data.session_id);
                            updateUserProperty('activeSurveySessionId', response.data.session_id);
                            // Refresh status untuk memuat data survei terbaru (mulus tanpa reload halaman)
                            setTimeout(() => {
                                refreshStatus();
                                refreshProgressSilent();
                            }, 100);
                        }
                        
                        // Format response untuk mendapatkan custom component properties
                        const systemResponse = {
                            info: 'question',
                            currentQuestion: q,
                            system_message: q.text
                        };
                        const botResponse = formatSurveyResponse(systemResponse);
                        
                        const questionMsgId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                        
                        // Buat final message dengan custom component properties
                        const finalMessage: ChatMessage = {
                            id: questionMsgId,
                            text: q.text,
                            user: false,
                            mode: "survey",
                            loading: false,
                            questionObject: q,
                            questionCode: q.code,
                            options: q.options || [],
                            customComponent: botResponse.customComponent,
                            responseType: botResponse.responseType,
                            infoText: botResponse.infoText,
                            questionText: botResponse.questionText,
                            timestamp: new Date().toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                            }),
                            read: false
                        };
                        
                        // Tambahkan pesan dengan custom component properties
                        setMessages(prevMessages => [...prevMessages, finalMessage]);
                        
                        // Persist to DB
                        addSurveyMessage({
                          user_message: null,
                          system_response: systemResponse,
                          mode: 'survey'
                        }).catch((err) => console.error('Failed to persist injected system question:', err));
                        animateTokenByToken(questionMsgId, q.text, () => {
                            if (q.options?.length) {
                                setVisibleOptions(prev => ({ ...prev, [questionMsgId]: q.options! }));
                            }
                        });
                    } else {
                        updateLastMessage("Gagal mengambil pertanyaan survei. Silakan coba refresh halaman.", false);
                    }
                } else {
                    // User belum siap
                    updateLastMessage("Tidak masalah, silakan beri tahu jika Anda sudah siap untuk memulai survei.", false);
                }
                setLoading(false);
                setBotIsTyping(false);
                return;
            }

            const token = getToken();
            const userData = getUserData();

            if (!token) throw new Error("Authentication token not found");
            if (!userData) throw new Error("User data not found");

            if (mode === 'survey') {
                await handleSurveyMode(userData, userMessage, loadingMsgId);
            } else {
                await handleQaMode(userMessage, loadingMsgId);

                // Reset QA mode timer pada setiap interaksi
                if (qaTimerRef.current) {
                    clearTimeout(qaTimerRef.current);
                }
                qaTimerRef.current = setTimeout(() => {
                    setShowModePopup(true);
                }, qaTimeoutDuration * 1000);
            }
        } catch (error) {
            console.error("Error processing message:", error);
            updateLastMessage("Terjadi kesalahan saat memproses pesan Anda. Silakan coba lagi.", false);
            setBotIsTyping(false);
        } finally {
            setLoading(false);
        }
    };

    // Handle mode QA
    const handleQaMode = async (userMessage: string, loadingMsgId: string) => {
        try {
            const ragResponse = await queryRAG(userMessage);
            console.log("RAG Response:", ragResponse);

            // Jika ada error dari RAG, tampilkan toast dan hentikan loading
            if (ragResponse.error) {
                setQaErrorToast({ open: true, message: ragResponse.message || "Terjadi kesalahan pada sistem RAG." });
                setBotIsTyping(false);
                updateLastMessage("", false);
                return;
            }

            // DEBUG: Log data yang akan disimpan ke database untuk QA mode
            console.log("🔍 DEBUG - QA Mode - Data yang akan disimpan ke database:", {
                user_message: userMessage,
                system_response: { answer: ragResponse.answer },
                mode: 'qa'
            });
            
            // Check if API already saved the message automatically
            // For QA mode, we always save since RAG API doesn't save automatically
            const apiAlreadySaved = false; // RAG API doesn't save messages automatically
            console.log("🔍 DEBUG - QA Mode - API sudah menyimpan pesan:", apiAlreadySaved);
            
            // Only save to database if API didn't save it automatically
            if (!apiAlreadySaved) {
                console.log("🔍 DEBUG - QA Mode - Menyimpan pesan ke database");
                await addUserAndSystemMessage(userMessage, { answer: ragResponse.answer }, 'qa');
            } else {
                console.log("🔍 DEBUG - QA Mode - Tidak menyimpan pesan ke database karena API sudah menyimpannya otomatis");
            }

            // Format respons untuk ditampilkan ke user
            const botResponse = formatSurveyResponse({ answer: ragResponse.answer });
            
            // Extract custom component properties from botResponse
            const customProps: Partial<ChatMessage> = {
                customComponent: botResponse.customComponent,
                infoText: botResponse.infoText,
                infoSource: botResponse.infoSource,
                responseType: botResponse.responseType,
                options: botResponse.options
            };

            updateLastMessage(ragResponse.answer ?? "No response available", false, customProps);
            animateTokenByToken(loadingMsgId, ragResponse.answer ?? "No response available");
        } catch (error) {
            setQaErrorToast({ open: true, message: error instanceof Error ? error.message : "Terjadi kesalahan saat memproses pesan Anda." });
            setBotIsTyping(false);
            updateLastMessage("", false);
        }
    };

    // Handle mode survei
    const handleSurveyMode = async (userData: UserData, userMessage: string, loadingMsgId: string) => {
        try {
            // Kirim permintaan ke API unified /api/survey/respond
            const response = await submitResponse(userMessage);
            
            // DEBUG: Log response untuk melihat apakah API sudah menyimpan pesan
            console.log("🔍 DEBUG - Response dari submitResponse:", response);
            console.log("🔍 DEBUG - Response memiliki success:", response.success);
            console.log("🔍 DEBUG - Response memiliki session_id:", response.session_id);
    
            // Simpan session_id jika ada dalam response
            if (response.session_id && !userData.activeSurveySessionId) {
                console.log("Menyimpan activeSurveySessionId:", response.session_id);
                updateUserProperty('activeSurveySessionId', response.session_id);
                // Refresh status untuk memuat data survei terbaru (mulus tanpa reload halaman)
                setTimeout(() => {
                    refreshStatus();
                            refreshProgressSilent();
                }, 100);
            }
    
            // Format respons untuk ditampilkan ke user
            const botResponse = formatSurveyResponse(response);
    
            // Update current question state jika ada
            if (botResponse.questionObject) {
                setCurrentQuestion(botResponse.questionObject);
            }
    
            // DEBUG: Log data yang akan disimpan ke database
            console.log("🔍 DEBUG - Data yang akan disimpan ke database:", {
                user_message: userMessage,
                system_response: response,
                mode: 'survey'
            });
            
            // Check if API already saved the message automatically
            // If response has success: true and session_id, it might have been saved automatically
            const apiAlreadySaved = response.success === true && response.session_id;
            console.log("🔍 DEBUG - API sudah menyimpan pesan:", apiAlreadySaved);
            
            // Only save to database if API didn't save it automatically
            if (!apiAlreadySaved) {
                console.log("🔍 DEBUG - Menyimpan pesan ke database karena API tidak menyimpannya otomatis");
                addUserAndSystemMessage(userMessage, response, 'survey');
            } else {
                console.log("🔍 DEBUG - Tidak menyimpan pesan ke database karena API sudah menyimpannya otomatis");
            }
    
            // Perlakuan khusus untuk pertanyaan KR004
            if (botResponse.questionObject?.code === "KR004" && botResponse.questionObject?.options?.length) {
                console.log("Terdeteksi pertanyaan KR004 - menampilkan dengan opsi lengkap");

                // Buat final message dengan custom component properties (REPLACE loading message, jangan tambah baru)
                const finalMessage: ChatMessage = {
                    id: loadingMsgId,
                    text: typeof botResponse.text === 'string' ? botResponse.text : String(botResponse.text),
                    user: false,
                    mode: 'survey',
                    loading: false,
                    customComponent: botResponse.customComponent,
                    responseType: botResponse.responseType,
                    questionCode: botResponse.questionCode,
                    questionObject: botResponse.questionObject,
                    infoText: botResponse.infoText,
                    questionText: botResponse.questionText,
                    options: botResponse.options || [],
                    timestamp: new Date().toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                    }),
                    read: false
                };

                // Replace the loading message with the final message (bukan menambah baru)
                setMessages(prevMessages => 
                    prevMessages.map(msg => 
                        msg.id === loadingMsgId ? finalMessage : msg
                    )
                );

                // We still animate the text for a nice effect
                animateTokenByToken(loadingMsgId, typeof botResponse.text === 'string' ? botResponse.text : String(botResponse.text), () => {
                    // We're adding options synchronously below, so no need for 
                    // additional animations here. This improves UX by showing options
                    // immediately
                    setAnimatingMessageId(null);
                });
            } else {
                // For other questions, replace the loading message with the formatted response
                // This ensures custom components are applied immediately
                const finalMessage: ChatMessage = {
                    id: loadingMsgId,
                    text: typeof botResponse.text === 'string' ? botResponse.text : String(botResponse.text),
                    user: false,
                    mode: 'survey',
                    loading: false,
                    customComponent: botResponse.customComponent,
                    responseType: botResponse.responseType,
                    questionCode: botResponse.questionCode,
                    questionObject: botResponse.questionObject,
                    infoText: botResponse.infoText,
                    infoSource: botResponse.infoSource,
                    questionText: botResponse.questionText,
                    options: botResponse.options || [],
                    timestamp: new Date().toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                    }),
                    read: false
                };
                
                // Replace the loading message with the final message
                setMessages(prevMessages => 
                    prevMessages.map(msg => 
                        msg.id === loadingMsgId ? finalMessage : msg
                    )
                );
                
                // Animate token by token
                animateTokenByToken(loadingMsgId, typeof botResponse.text === 'string' ? botResponse.text : String(botResponse.text), () => {
                    // If there are options, show them immediately 
                    if (botResponse.questionObject?.options?.length) {
                        setVisibleOptions(prev => ({
                            ...prev,
                            [loadingMsgId]: botResponse.questionObject?.options || []
                        }));
                    }
                });
            }
            
            // Refresh data progress setelah menjawab pertanyaan
            setTimeout(() => {
                refreshStatus();
                refreshAnsweredQuestions();
                refreshProgressSilent();
            }, 500);
    
        } catch (error) {
            console.error("Error dalam mode survei:", error);
            updateLastMessage("Terjadi kesalahan saat memproses pesan Anda. Silakan coba lagi.", false);
            setBotIsTyping(false);
        }
    };

    // Fungsi untuk menutup semua dropdown
    const closeAllDropdowns = () => {
        setSidebarOpen(false);
        setThemeMenuOpen(false);
    };

    // Function to scroll to bottom
    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior });
        }
    };

    return (
        <div className={`flex flex-col min-h-screen relative
            ${isDarkMode
                ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900'
                : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100'}`}>

            {/* Background pattern with theme-aware colors */}
            <div
                className="absolute inset-0 z-0 bg-pattern"
                aria-hidden="true"
            />

            {/* Background Pattern */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
            </div>

            {/* Mode Confirmation Popup */}
            <ModeConfirmationPopup
                isOpen={showModePopup}
                onClose={() => setShowModePopup(false)}
                onSwitchMode={handleSwitchToSurvey}
                isDarkMode={isDarkMode}
                countdown={popupCountdown}
            />

            {/* Toast Error (letakkan setelah <ModeConfirmationPopup />) */}
            {qaErrorToast.open && (
                <div className="fixed top-6 right-6 z-50">
                    <div className="bg-red-600 text-white px-4 py-3 rounded shadow-lg flex items-center space-x-2 animate-fade-in">
                        <span className="font-semibold">Error:</span>
                        <span>{qaErrorToast.message}</span>
                        <button
                            className="ml-4 text-white hover:text-gray-200"
                            onClick={() => setQaErrorToast({ open: false, message: "" })}
                            aria-label="Tutup"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {/* Sidebar */}
            <ChatSidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                isDarkMode={isDarkMode}
            />

            {/* Header */}
            <ChatHeader
                isDarkMode={isDarkMode}
                mode={mode}
                onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
                themeMenuOpen={themeMenuOpen}
                setThemeMenuOpen={setThemeMenuOpen}
                closeOtherDropdowns={() => setSidebarOpen(false)}
            />

            {/* Main Content */}
            <ChatMessageArea
                messages={messages}
                isDarkMode={isDarkMode}
                mode={mode}
                messagesEndRef={messagesEndRef}
                chatContainerRef={chatContainerRef}
                closeAllDropdowns={closeAllDropdowns}
                visibleOptions={visibleOptions}
                animatingMessageId={animatingMessageId}
                currentQuestion={currentQuestion}
                animatingText={animatingText}
            />

            {/* Scroll to Bottom Button */}
            <ChatScrollButton
                show={showScrollButton}
                isDarkMode={isDarkMode}
                onClick={handleScrollToBottom}
            />

            {/* Input Area */}
            <ChatInputArea
                input={input}
                setInput={setInput}
                isDarkMode={isDarkMode}
                mode={mode}
                setMode={setModeDispatch}
                botIsTyping={botIsTyping}
                onSend={handleSend}
                onStopGeneration={stopTokenGeneration}
                closeAllDropdowns={closeAllDropdowns}
            />
        </div>
    );
};

export default ChatLayout;