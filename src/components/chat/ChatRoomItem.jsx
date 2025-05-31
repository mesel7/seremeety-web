import { useNavigate } from "react-router-dom";
import { formatTimeStampForList } from "../../utils";
import "./ChatRoomItem.css";
import ImageLoading from "../common/ImageLoading";
import { useState } from "react";

export const ChatRoomItem = ({ id, nickname, profilePictureUrl, lastMessage }) => {
    const [isImgLoaded, setIsImgLoaded] = useState(false);
    const navigate = useNavigate();

    const handleChatRoomClick = () => {
        navigate(`/chat-room/${id}`);
    };

    return (
        <div className="ChatRoomItem" onClick={handleChatRoomClick}>
            <div className="img_section">
                {!isImgLoaded && <ImageLoading borderRadius={"50%"} />}
                <img
                    alt={"PROFILE"}
                    src={profilePictureUrl}
                    onLoad={() => setIsImgLoaded(true)}
                    style={{ display: !isImgLoaded ? "none" : "block" }}
                />
            </div>
            <div className="content_section">
                <div className="info_wrapper">
                    <div className="nickname_wrapper">{nickname}</div>
                    <div className="sent_at_wrapper">{formatTimeStampForList(lastMessage.sentAt)}</div>
                </div>
                <div className="last_message_wrapper">
                    {lastMessage.text}
                </div>
            </div>
        </div>
    );
};