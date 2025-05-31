import { useNavigate, useParams } from "react-router-dom";
import ChatRoomHeader from "../components/chat_room/ChatRoomHeader";
import ChatRoomContent from "../components/chat_room/ChatRoomContent";
import ChatRoomInput from "../components/chat_room/ChatRoomInput";
import { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getChatRoomById, getUserDataByUid, subscribeToChatRoomMessages } from "../utils";
import { auth } from "../firebase";
import { ChatDispatchContext } from "../contexts/ChatContext";
import Swal from "sweetalert2";
import PageTransition from "../components/common/PageTransition";
import Loading from "../components/common/Loading";
import useElementHeight from "../hooks/useElementHeight";

const ChatRoom = () => {
    const { chatRoomId } = useParams();
    const [chatRoomMessages, setChatRoomMessages] = useState([]);
    const [otherUserData, setOtherUserData] = useState({});
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    const { onUpdate } = useContext(ChatDispatchContext);
    const navigate = useNavigate();

    const headerRef = useRef(null);
    const footerRef = useRef(null);
    const contentHeight = useElementHeight(headerRef, footerRef);

    useEffect(() => {
        const fetchChatRoomData = async () => {
            try {
                const chatRoomData = await getChatRoomById(chatRoomId);

                if (!chatRoomData) {
                    Swal.fire({
                        title: "오류",
                        text: "존재하지 않는 채팅방입니다",
                        icon: "error",
                        confirmButtonText: "확인",
                        customClass: {
                            confirmButton: 'no-focus-outline'
                        },
                        willClose: () => {
                            navigate(-1, { replace: true });
                        }
                    });
                    return;
                }

                setOtherUserData(await getUserDataByUid(
                    chatRoomData.users[0] !== auth.currentUser.uid ?
                    chatRoomData.users[0] : 
                    chatRoomData.users[1]
                ));
            } catch (error) {
                console.log(error);
            }
        };

        fetchChatRoomData();
        const unsubscribe = subscribeToChatRoomMessages(chatRoomId, (messages) => {
            setChatRoomMessages(messages);
            setIsDataLoaded(true);
        });

        return () => {
            console.log("unsubscribe to chat room messages");
            unsubscribe();
        }
    }, [chatRoomId]);

    if (!isDataLoaded) {
        return <Loading />
    } else {
        return (
            <div className="ChatRoom">
                <PageTransition>
                    <ChatRoomHeader ref={headerRef} nickname={otherUserData.nickname}/>
                    <ChatRoomContent
                        chatRoomMessages={chatRoomMessages}
                        nickname={otherUserData.nickname}
                        profilePictureUrl={otherUserData.profilePictureUrl}
                        style={{ height: contentHeight }}
                    />
                    <ChatRoomInput ref={footerRef} onUpdateChatRoom={onUpdate} chatRoomId={chatRoomId} />
                </PageTransition>
            </div>
        );
    }
};

export default ChatRoom;