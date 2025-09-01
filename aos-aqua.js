               class AOS {
            constructor(options = {}) {
                this.options = {
                    offset: options.offset || 120,
                    delay: options.delay || 0,
                    duration: options.duration || 400,
                    easing: options.easing || 'ease',
                    once: options.once || false,
                    disable: options.disable || false,
                    startEvent: options.startEvent || 'DOMContentLoaded',
                    ...options
                };
                
                this.elements = [];
                this.observer = null;
                
                if (this.options.startEvent === 'DOMContentLoaded') {
                    document.addEventListener('DOMContentLoaded', this.init.bind(this));
                } else {
                    this.init();
                }
            }

            init() {
                if (this.options.disable) return;
                
                // Get all elements with data-aos attribute
                this.elements = document.querySelectorAll('[data-aos]');
                
                // Set initial styles
                this.setInitialStyles();
                
                // Set up intersection observer
                this.setupObserver();
                
                // Handle scroll and resize events
                this.bindEvents();
            }

            setInitialStyles() {
                this.elements.forEach(element => {
                    const animationType = element.getAttribute('data-aos');
                    const duration = element.getAttribute('data-aos-duration') || this.options.duration;
                    const easing = element.getAttribute('data-aos-easing') || this.options.easing;
                    
                    // Set transition properties
                    element.style.transition = `all ${duration}ms ${easing}`;
                    element.style.willChange = 'transform, opacity, filter';
                    
                    // Set initial state based on animation type
                    this.applyInitialState(element, animationType);
                });
            }

            applyInitialState(element, animationType) {
                // Reset any previous styles
                element.style.opacity = '0';
                element.style.transform = '';
                element.style.filter = '';
                
                switch(animationType) {
                    // Basic Fade Animations
                    case 'fade':
                        element.style.opacity = '0';
                        break;
                    case 'fade-up':
                        element.style.opacity = '0';
                        element.style.transform = 'translateY(100px)';
                        break;
                    case 'fade-down':
                        element.style.opacity = '0';
                        element.style.transform = 'translateY(-100px)';
                        break;
                    case 'fade-left':
                        element.style.opacity = '0';
                        element.style.transform = 'translateX(100px)';
                        break;
                    case 'fade-right':
                        element.style.opacity = '0';
                        element.style.transform = 'translateX(-100px)';
                        break;
                    
                    // Slide Animations
                    case 'slide-up':
                        element.style.transform = 'translateY(100%)';
                        break;
                    case 'slide-down':
                        element.style.transform = 'translateY(-100%)';
                        break;
                    case 'slide-left':
                        element.style.transform = 'translateX(100%)';
                        break;
                    case 'slide-right':
                        element.style.transform = 'translateX(-100%)';
                        break;
                    
                    // Zoom Animations
                    case 'zoom-in':
                        element.style.opacity = '0';
                        element.style.transform = 'scale(0.5)';
                        break;
                    case 'zoom-in-up':
                        element.style.opacity = '0';
                        element.style.transform = 'translateY(100px) scale(0.5)';
                        break;
                    case 'zoom-in-down':
                        element.style.opacity = '0';
                        element.style.transform = 'translateY(-100px) scale(0.5)';
                        break;
                    case 'zoom-in-left':
                        element.style.opacity = '0';
                        element.style.transform = 'translateX(100px) scale(0.5)';
                        break;
                    case 'zoom-in-right':
                        element.style.opacity = '0';
                        element.style.transform = 'translateX(-100px) scale(0.5)';
                        break;
                    
                    // Flip Animations
                    case 'flip':
                        element.style.transform = 'perspective(2500px) rotateX(-90deg)';
                        break;
                    case 'flip-up':
                        element.style.transform = 'perspective(2500px) rotateX(-90deg)';
                        break;
                    case 'flip-down':
                        element.style.transform = 'perspective(2500px) rotateX(90deg)';
                        break;
                    case 'flip-left':
                        element.style.transform = 'perspective(2500px) rotateY(-90deg)';
                        break;
                    case 'flip-right':
                        element.style.transform = 'perspective(2500px) rotateY(90deg)';
                        break;
                    
                    // Attention Seekers
                    case 'bounce':
                        element.style.opacity = '0';
                        break;
                    case 'bounce-in':
                        element.style.opacity = '0';
                        element.style.transform = 'scale(0.3)';
                        break;
                    case 'tada':
                        element.style.opacity = '0';
                        break;
                    case 'pulse':
                        element.style.opacity = '0';
                        break;
                    case 'rubber-band':
                        element.style.opacity = '0';
                        element.style.transform = 'scale(0)';
                        break;
                    case 'shake':
                        element.style.opacity = '0';
                        break;
                    case 'pop':
                        element.style.opacity = '0';
                        element.style.transform = 'scale(0)';
                        break;
                    case 'swing':
                        element.style.opacity = '0';
                        element.style.transform = 'rotate(-30deg)';
                        break;
                    
                    // Modern Effects
                    case 'blur-in':
                        element.style.opacity = '0';
                        element.style.filter = 'blur(20px)';
                        break;
                    case 'blur-out':
                        element.style.opacity = '1';
                        element.style.filter = 'blur(0)';
                        break;
                    case 'glow-in':
                        element.style.opacity = '0';
                        element.style.filter = 'brightness(0)';
                        break;
                    case 'clip-in':
                        element.style.opacity = '0';
                        element.style.clipPath = 'polygon(0 0, 0 0, 0 100%, 0 100%)';
                        break;
                    case 'clip-in-vertical':
                        element.style.opacity = '0';
                        element.style.clipPath = 'polygon(0 0, 100% 0, 100% 0, 0 0)';
                        break;
                    case 'clip-in-horizontal':
                        element.style.opacity = '0';
                        element.style.clipPath = 'polygon(0 0, 0 0, 0 100%, 0 100%)';
                        break;
                    case 'flip-3d':
                        element.style.transform = 'perspective(2500px) rotateX(-90deg)';
                        break;
                    case 'flip-3d-vertical':
                        element.style.transform = 'perspective(2500px) rotateX(-90deg)';
                        break;
                    case 'flip-3d-horizontal':
                        element.style.transform = 'perspective(2500px) rotateY(-90deg)';
                        break;
                    
                    // Default
                    default:
                        element.style.opacity = '0';
                }
            }

            setupObserver() {
                const observerOptions = {
                    root: null,
                    rootMargin: `0px 0px -${this.options.offset}px 0px`,
                    threshold: 0
                };

                this.observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            this.animateIn(entry.target);
                            
                            // If once option is true, stop observing after animation
                            const once = entry.target.getAttribute('data-aos-once') !== 'false' && this.options.once;
                            if (once) {
                                this.observer.unobserve(entry.target);
                            }
                        } else {
                            // Animate out if needed
                            const animateOut = entry.target.getAttribute('data-aos-animate-out');
                            if (animateOut === 'true') {
                                this.animateOut(entry.target);
                            }
                        }
                    });
                }, observerOptions);

                // Observe all elements
                this.elements.forEach(element => {
                    this.observer.observe(element);
                });
            }

            animateIn(element) {
                const animationType = element.getAttribute('data-aos');
                const delay = element.getAttribute('data-aos-delay') || this.options.delay;
                
                setTimeout(() => {
                    // Reset to default visible state
                    element.style.opacity = '1';
                    element.style.transform = '';
                    element.style.filter = '';
                    element.style.clipPath = '';
                    
                    // Apply specific animation final states
                    switch(animationType) {
                        case 'bounce':
                            element.classList.add('aos-bounce');
                            break;
                        case 'tada':
                            element.classList.add('aos-tada');
                            break;
                        case 'pulse':
                            element.classList.add('aos-pulse');
                            break;
                        case 'rubber-band':
                            element.classList.add('aos-rubber-band');
                            break;
                        case 'shake':
                            element.classList.add('aos-shake');
                            break;
                        case 'pop':
                            element.classList.add('aos-pop');
                            break;
                        case 'swing':
                            element.classList.add('aos-swing');
                            break;
                    }
                }, parseInt(delay));
            }

            animateOut(element) {
                const animationType = element.getAttribute('data-aos');
                this.applyInitialState(element, animationType);
            }

            bindEvents() {
                // Refresh on window resize
                window.addEventListener('resize', () => {
                    this.refresh();
                });

                // Refresh on images load (if any)
                window.addEventListener('load', () => {
                    this.refresh();
                });
            }

            refresh() {
                // Reinitialize the observer
                if (this.observer) {
                    this.elements.forEach(element => {
                        this.observer.unobserve(element);
                    });
                }
                
                // Get elements again (in case new ones were added)
                this.elements = document.querySelectorAll('[data-aos]');
                this.setInitialStyles();
                this.setupObserver();
            }

            // Public method to refresh manually
            static refresh() {
                if (window.aosInstance) {
                    window.aosInstance.refresh();
                }
            }
        }

        // Initialize AOS when DOM is loaded
        document.addEventListener('DOMContentLoaded', () => {
            window.aosInstance = new AOS();
            
            // Set up control handlers
            document.getElementById('refresh-btn').addEventListener('click', () => {
                const options = {
                    offset: parseInt(document.getElementById('offset').value),
                    delay: parseInt(document.getElementById('delay').value),
                    duration: parseInt(document.getElementById('duration').value),
                    easing: document.getElementById('easing').value,
                    once: document.getElementById('once').value === 'true'
                };
                
                // Create new instance with updated options
                window.aosInstance = new AOS(options);
            });
        });

        // Add CSS for keyframe animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes aos-bounce {
                0%, 20%, 53%, 80%, 100% {transform: translate3d(0,0,0);}
                40%, 43% {transform: translate3d(0, -15px, 0);}
                70% {transform: translate3d(0, -7px, 0);}
                90% {transform: translate3d(0, -3px, 0);}
            }
            
            @keyframes aos-tada {
                0% {transform: scale(1);}
                10%, 20% {transform: scale(0.9) rotate(-3deg);}
                30%, 50%, 70%, 90% {transform: scale(1.1) rotate(3deg);}
                40%, 60%, 80% {transform: scale(1.1) rotate(-3deg);}
                100% {transform: scale(1) rotate(0);}
            }
            
            @keyframes aos-pulse {
                0% {transform: scale(1);}
                50% {transform: scale(1.05);}
                100% {transform: scale(1);}
            }
            
            @keyframes aos-rubber-band {
                0% {transform: scale(1);}
                30% {transform: scale(1.25);}
            40% {transform: scale(0.75);}
            50% {transform: scale(1.15);}
            65% {transform: scale(0.95);}
            75% {transform: scale(1.05);}
            100% {transform: scale(1);}
            }
            
            @keyframes aos-shake {
                0%, 100% {transform: translateX(0);}
                10%, 30%, 50%, 70%, 90% {transform: translateX(-5px);}
                20%, 40%, 60%, 80% {transform: translateX(5px);}
            }
            
            @keyframes aos-pop {
                0% {transform: scale(0);}
                50% {transform: scale(1.2);}
                100% {transform: scale(1);}
            }
            
            @keyframes aos-swing {
                20% {transform: rotate(15deg);}
                40% {transform: rotate(-10deg);}
                60% {transform: rotate(5deg);}
                80% {transform: rotate(-5deg);}
                100% {transform: rotate(0deg);}
            }
            
            .aos-bounce {
                animation: aos-bounce 1s;
            }
            
            .aos-tada {
                animation: aos-tada 1s;
            }
            
            .aos-pulse {
                animation: aos-pulse 1s;
            }
            
            .aos-rubber-band {
                animation: aos-rubber-band 1s;
            }
            
            .aos-shake {
                animation: aos-shake 1s;
            }
            
            .aos-pop {
                animation: aos-pop 0.5s;
            }
            
            .aos-swing {
                animation: aos-swing 1s;
                transform-origin: top center;
            }
        `;
        document.head.appendChild(style);
    
