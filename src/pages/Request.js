import BottomMenu from "../components/common/BottomMenu";
import PageHeader from "../components/common/PageHeader";
import RequestContent from "../components/request/RequestContent";

const Request = () => {
    return (
        <div className="Request">
            <PageHeader page={"request"} />
            <RequestContent />
            <BottomMenu />
        </div>
    );
};

export default Request;