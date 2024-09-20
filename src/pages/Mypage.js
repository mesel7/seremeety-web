import { useContext, useRef } from "react";
import PageHeader from "../components/common/PageHeader";
import BottomMenu from "../components/common/BottomMenu";
import { MypageStateContext } from "../contexts/MypageContext";
import Loading from "../components/common/Loading";
import MyContent from "../components/mypage/MyContent";
import useElementHeight from "../hooks/useElementHeight";

const Mypage = () => {
    const state = useContext(MypageStateContext);
    console.log(state);

    const headerRef = useRef(null);
    const footerRef = useRef(null);
    const contentHeight = useElementHeight(headerRef, footerRef);

    if (Object.keys(state).length <= 0) {
        return <Loading />;
    } else {
        return (
            <div className="Mypage">
                <PageHeader ref={headerRef} page={"mypage"} userProfile={state} />
                    <MyContent userProfile={state} style={{ height: contentHeight }} />
                <BottomMenu ref={footerRef} />
            </div>
        );
    }
};

export default Mypage;