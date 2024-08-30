import "./ChatContent.css";
import { ChatRoomItem } from "./ChatRoomItem";
import { useEffect, useState } from "react";
import { auth } from "../../firebase";
import { getUserDataByUid } from "../../utils";
import Loading from "../common/Loading";

const ChatContent = ({ chatRooms }) => {
    const [enhancedChatRooms, setEnhancedChatRooms] = useState([]);
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    const addProfileDataInChatRooms = async (chatRoom) => {
        const otherUserUid = chatRoom.users[0] !== auth.currentUser.uid ?
        chatRoom.users[0] :
        chatRoom.users[1]; 

        try {
            const otherUserData = await getUserDataByUid(otherUserUid);
            return {
                ...chatRoom,
                nickname: otherUserData.nickname,
                profilePictureUrl: otherUserData.profilePictureUrl
            };
        } catch (error) {
            console.log(error);
            return chatRoom;
        }
    };

    useEffect(() => {
        const enhanceChatRooms = async () => {
            setEnhancedChatRooms(await Promise.all(chatRooms.map(addProfileDataInChatRooms)));
            setIsDataLoaded(true);
        };

        enhanceChatRooms();
    }, [chatRooms]);

    if (!isDataLoaded) {
        return <Loading />
    } else {
        return (
            <div className="ChatContent">
                {enhancedChatRooms.map((it) => (
                    <ChatRoomItem key={it.id} {...it} />
                ))}
            </div>
        );
    }
};

export default ChatContent;