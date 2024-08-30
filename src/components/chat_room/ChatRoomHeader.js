import "./ChatRoomHeader.css";

const ChatRoomHeader = ({ nickname }) => {
    return (
        <div className="ChatRoomHeader">
            <h3>{nickname}</h3>
        </div>
    );
};

export default ChatRoomHeader;