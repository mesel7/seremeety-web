import "./PageContainer.css";
import PageContent from "./PageContent";
import PageHeader from "./PageHeader";

const PageContainer = ({ page }) => {
    return (
        <div className="PageContainer">
            <PageHeader page={page} />
            <PageContent page={page} />
        </div>
    );
};

export default PageContainer;