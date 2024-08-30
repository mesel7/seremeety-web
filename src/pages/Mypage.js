import { useContext } from "react";
import PageHeader from "../components/common/PageHeader";
import BottomMenu from "../components/common/BottomMenu";
import { MypageStateContext } from "../contexts/MypageContext";
import SettingContent from "../components/setting/SettingContent";
import MyProfilePreview from "../components/mypage/MyProfilePreview";
import Loading from "../components/common/Loading";

const Mypage = () => {
    const state = useContext(MypageStateContext);
    console.log(state);

    if (Object.keys(state).length <= 0) {
        return <Loading />;
    } else {
        return (
            <div className="Mypage">
                <PageHeader page={"mypage"} />
                <MyProfilePreview userProfile={state} />
                <SettingContent />
                <BottomMenu />
            </div>
        );
    }
};

export default Mypage;