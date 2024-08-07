import { useContext } from "react";
import PageHeader from "../components/common/PageHeader";
import MypageContent from "../components/mypage/MypageContent";
import BottomMenu from "../components/common/BottomMenu";
import { MypageDispatchContext, MypageStateContext } from "../contexts/MypageContext";

const Mypage = () => {
    const state = useContext(MypageStateContext);
    console.log(state);
    const { onUpdate } = useContext(MypageDispatchContext);

    const onSave = (formData) => {
        onUpdate({
            ...formData,
            profileStatus: 1
        });
    };

    return (
        <div className="Mypage">
            <PageHeader page={"mypage"} />
            <MypageContent userProfile={state} onSave={onSave}/>
            <BottomMenu />
        </div>
    );
};

export default Mypage;