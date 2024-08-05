import BottomMenu from "../components/BottomMenu";
import PageContainer from "../components/PageContainer";

const Chat = () => {
    return (
        <div className="ChatList">
            <PageContainer page={"chat"} />
            <BottomMenu />
        </div>
    );
};

export default Chat;