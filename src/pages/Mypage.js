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

    if (!state || !onUpdate) {
        return <div>데이터를 불러오는 중입니다</div>;
    } else {
        return (
            <div className="Mypage">
                <PageHeader page={"mypage"} />
                <MypageContent userProfile={state} onSave={onSave}/>
                <BottomMenu />
            </div>
        );
    }
};

export default Mypage;