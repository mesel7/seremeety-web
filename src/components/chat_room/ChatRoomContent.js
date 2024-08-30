import { auth } from "../../firebase";
import ChatMessage from "./ChatMessage";
import "./ChatRoomContent.css";

const ChatRoomContent = ({ chatRoomMessages, nickname, profilePictureUrl }) => {
    return (
        <div className="ChatRoomContent">
            {chatRoomMessages &&
                chatRoomMessages.map((it) => (
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