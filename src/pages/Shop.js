import PageHeader from "../components/common/PageHeader";
import ShopContent from "../components/shop/ShopContent";
import PageTransition from "../components/common/PageTransition";
import { useContext } from "react";
import { MypageDispatchContext, MypageStateContext } from "../contexts/MypageContext";

const Shop = () => {
    const state = useContext(MypageStateContext);
    const { onUpdateCoin } = useContext(MypageDispatchContext);

    return (
        <div className="Shop">
            <PageTransition>
                <PageHeader page={"shop"} userProfile={state} />
                <ShopContent userProfile={state} onUpdateCoin={onUpdateCoin} />
            </PageTransition>
        </div>
    );
};

export default Shop;