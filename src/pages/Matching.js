import ChatContent from "../components/chat/ChatContent";
import BottomMenu from "../components/common/BottomMenu";
import PageHeader from "../components/common/PageHeader";

const Matching = () => {
    return (
        <div className="Matching">
            <PageHeader page={"matching"} />
            <ChatContent />
            <BottomMenu />
        </div>
    );
};

export default Matching;