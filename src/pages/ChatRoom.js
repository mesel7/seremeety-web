import { useNavigate, useParams } from "react-router-dom";
import ChatRoomHeader from "../components/chat_room/ChatRoomHeader";
import ChatRoomContent from "../components/chat_room/ChatRoomContent";
import ChatRoomInput from "../components/chat_room/ChatRoomInput";
import { useContext, useEffect, useState } from "react";
import { getChatRoomById, getUserDataByUid, subscribeToChatRoomMessages } from "../utils";
import { auth } from "../firebase";
import { ChatDispatchContext } from "../contexts/ChatContext";
import Swal from "sweetalert2";
import PageTransition from "../components/common/PageTransition";

const ChatRoom = () => {
    const { chatRoomId } = useParams();
    const [chatRoomMessages, setChatRoomMessages] = useState([]);
    const [otherUserData, setOtherUserData] = useState({});

    const { onUpdate } = useContext(ChatDispatchContext);
    const navigate = useNavigate();

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
        const unsubscribe = subscribeToChatRoomMessages(chatRoomId, setChatRoomMessages);

        return () => {
            console.log("unsubscribe to chat room messages");
            unsubscribe();
        }
    }, [chatRoomId]);

    useEffect(() => {
        console.log("scroll to bottom");
        document.documentElement.scrollTop = document.documentElement.scrollHeight;
    });

    return (
        <div className="ChatRoom">
            <PageTransition>
                <ChatRoomHeader nickname={otherUserData.nickname}/>
                <ChatRoomContent
                    chatRoomMessages={chatRoomMessages}
                    nickname={otherUserData.nickname}
                    profilePictureUrl={otherUserData.profilePictureUrl}
                />
                <ChatRoomInput onUpdateChatRoom={onUpdate} chatRoomId={chatRoomId} />
            </PageTransition>
        </div>
    );
};

export default ChatRoom;