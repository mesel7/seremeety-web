import { forwardRef, useState } from "react";
import "./ChatRoomInput.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "../../utils";

const ChatRoomInput = forwardRef(({ onUpdateChatRoom, chatRoomId }, ref) => {
    const [chatMessage, setChatMessage] = useState("");

    const handleInputMessage = (e) => {
        setChatMessage(e.target.value);
    };

    const handleSendMessage = async () => {
        await onUpdateChatRoom(chatMessage, chatRoomId);
        setChatMessage("");
    };

    return (
        <div className="ChatRoomInput" ref={ref}>
            <input type={"text"} value={chatMessage} onChange={handleInputMessage} />
            <div className="send_icon_wrapper">
            {chatMessage && (
                <FontAwesomeIcon
                    icon={icons.faPaperPlane}
                    style={{ color: "#92a8d1" }}
                    size={"2x"}
                    onClick={handleSendMessage}
                />
            )}
            </div>
        </div>
    );
});

export default ChatRoomInput;