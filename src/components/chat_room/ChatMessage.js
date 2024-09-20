import React from "react";
import { useState } from "react";
import { formatTimeStampForMessage } from "../../utils";
import "./ChatMessage.css";
import ImageLoading from "../common/ImageLoading";

const ChatMessage = ({ isMyMsg, nickname, profilePictureUrl, text, sentAt }) => {
    const [isImgLoaded, setIsImgLoaded] = useState(false);

    return (
        <div className={["ChatMessage", `ChatMessage_${isMyMsg ? "my" : "other"}`].join(" ")}>
            {!isMyMsg && (
                <div className="img_section">
                    {!isImgLoaded && <ImageLoading borderRadius={"50%"} />}
                    <img
                        alt={"PROFILE"}
                        src={profilePictureUrl}
                        onLoad={() => setIsImgLoaded(true)}
                        style={{ display: !isImgLoaded ? "none" : "block" }}
                    />
                </div>
            )}
            <div className="content_section">
                {!isMyMsg && <div className="nickname_wrapper">{nickname}</div>}
                <div className="message_wrapper">{text}</div>
            </div>
            <div className="sent_at_wrapper">{formatTimeStampForMessage(sentAt)}</div>
        </div>
    );
};

export default React.memo(ChatMessage);