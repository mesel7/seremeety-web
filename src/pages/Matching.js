import { useContext } from "react";
import BottomMenu from "../components/common/BottomMenu";
import PageHeader from "../components/common/PageHeader";
import { MatchingStateContext } from "../contexts/MatchingContext";
import MatchingContent from "../components/matching/MatchingContent";
import Loading from "../components/common/Loading";

const Matching = () => {
    const state = useContext(MatchingStateContext);
    console.log(state);

    if (!state) {
        return <Loading />;
    } else {
        return (
            <div className="Matching">
                <PageHeader page={"matching"} />
                <MatchingContent profileCards={state} />
                <BottomMenu />
            </div>
        );
    }
};

export default Matching;