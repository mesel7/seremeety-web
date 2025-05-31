import { useContext, useEffect, useRef } from "react";
import ChatContent from "../components/chat/ChatContent";
import BottomMenu from "../components/common/BottomMenu";
import PageHeader from "../components/common/PageHeader";
import { ChatStateContext } from "../contexts/ChatContext";
import useElementHeight from "../hooks/useElementHeight";

const Chat = () => {
    const state = useContext(ChatStateContext);

    const headerRef = useRef(null);
    const footerRef = useRef(null);
    const contentHeight = useElementHeight(headerRef, footerRef);

    return (
        <div className="ChatList">
            <PageHeader ref={headerRef} page={"chat"}/>
            <ChatContent chatRooms={state} style={{ height: contentHeight }} />
            <BottomMenu ref={footerRef}/>
        </div>
    );
};

export default Chat;