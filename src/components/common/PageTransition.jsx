import { useLocation } from "react-router-dom";
import { useTransition, animated } from "react-spring";

const PageTransition = ({ children, direction }) => {
    const location = useLocation();
    const transitions = useTransition(location, {
        from: {
            opacity: 0,
            transform: direction === 'y' ? 'translateY(-100%)' : 'translateX(100%)'
        },
        enter: {
            opacity: 1,
            transform: direction === 'y' ? 'translateY(0%)' : 'translateX(0%)'
        },
        leave: {
            opacity: 0,
            transform: direction === 'y' ? 'translateY(100%)' : 'translateX(-100%)'
        },
    });

    return transitions((props, item) => (
        <animated.div style={props} key={item.pathname}>
            {children}
        </animated.div>
    ));
}

export default PageTransition;