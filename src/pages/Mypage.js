import BottomMenu from "../components/BottomMenu";
import PageContainer from "../components/PageContainer";

const Mypage = () => {
    return (
        <div className="Mypage">
            <PageContainer page={"mypage"} />
            <BottomMenu />
        </div>
    );
};

export default Mypage;