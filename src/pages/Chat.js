import ChatContent from "../components/chat/ChatContent";
import BottomMenu from "../components/common/BottomMenu";
import PageHeader from "../components/common/PageHeader";

const Chat = () => {
    return (
        <div className="ChatList">
            <PageHeader page={"chat"}/>
            <ChatContent />
            <BottomMenu />
        </div>
    );
};

export default Chat;