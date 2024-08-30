import { useContext } from "react";
import ChatContent from "../components/chat/ChatContent";
import BottomMenu from "../components/common/BottomMenu";
import PageHeader from "../components/common/PageHeader";
import { ChatStateContext } from "../contexts/ChatContext";

const Chat = () => {
    const state = useContext(ChatStateContext);

    return (
        <div className="ChatList">
            <PageHeader page={"chat"}/>
            <ChatContent chatRooms={state} />
            <BottomMenu />
        </div>
    );
};

export default Chat;