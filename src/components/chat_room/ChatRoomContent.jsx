import { useEffect, useRef, useState } from "react";
import { auth } from "../../firebase";
import ChatMessage from "./ChatMessage";
import "./ChatRoomContent.css";
import { useInView } from "react-intersection-observer";

const ChatRoomContent = ({ chatRoomMessages, nickname, profilePictureUrl, style }) => {
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    const [visibleCount, setVisibleCount] = useState(20);
    const [prevHeight, setPrevHeight] = useState(0);

    const visibleCountRef = useRef(visibleCount);
    const chatRoomRef = useRef(null);
    const [ref, inView] = useInView();

    useEffect(() => {
        if (chatRoomRef.current) {
            console.log("scroll bottom");
            setTimeout(() => {
                chatRoomRef.current.scrollTop = chatRoomRef.current.scrollHeight - chatRoomRef.current.offsetHeight;
                setIsFirstLoad(false);
            }, 100);
        }
    }, [chatRoomMessages, isFirstLoad]);
 
    useEffect(() => {
        if (!isFirstLoad && inView && visibleCountRef.current < chatRoomMessages.length) {
            setPrevHeight(chatRoomRef?.current?.scrollHeight || 0);
            setVisibleCount((prevCount) => Math.min(prevCount + 20, chatRoomMessages.length));
            console.log("20 more msgs");
        }
    }, [inView]);

    useEffect(() => {
        if (prevHeight > 0 && chatRoomRef.current) {
            requestAnimationFrame(() => {
                chatRoomRef.current.scrollTop = chatRoomRef.current.scrollHeight - prevHeight;
            });
        }
    }, [prevHeight])

    useEffect(() => {
        visibleCountRef.current = visibleCount;
    }, [visibleCount])
    
    return (
        <div className="ChatRoomContent" ref={chatRoomRef} style={style}>
            <div ref={ref}/>
            {chatRoomMessages &&
                chatRoomMessages.slice(-visibleCount).map((it) => (
                <ChatMessage
                    key={it.id}
                    {...it}
                    isMyMsg={it.sender === auth.currentUser.uid}
                    nickname={nickname}
                    profilePictureUrl={profilePictureUrl}
                />
            ))}
        </div>
    );
};

export default ChatRoomContent;