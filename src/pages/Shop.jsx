import PageHeader from "../components/common/PageHeader";
import ShopContent from "../components/shop/ShopContent";
import PageTransition from "../components/common/PageTransition";
import { useContext, useRef } from "react";
import { MypageDispatchContext, MypageStateContext } from "../contexts/MypageContext";
import useElementHeight from "../hooks/useElementHeight";

const Shop = () => {
    const state = useContext(MypageStateContext);
    const { onUpdateCoin } = useContext(MypageDispatchContext);

    const headerRef = useRef(null);
    const footerRef = useRef(null);
    const contentHeight = useElementHeight(headerRef, footerRef);

    return (
        <div className="Shop">
            <PageTransition>
                <PageHeader ref={headerRef} page={"shop"} userProfile={state} />
                <ShopContent userProfile={state} onUpdateCoin={onUpdateCoin} style={{ height: contentHeight }}/>
            </PageTransition>
        </div>
    );
};

export default Shop;