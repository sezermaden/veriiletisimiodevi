using System;
using Windows.ApplicationModel;
using Windows.ApplicationModel.Activation;
using Windows.ApplicationModel.Core;
using Windows.Foundation;
using Windows.System.Profile;
using Windows.UI.Core;
using Windows.UI.ViewManagement;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;
using Windows.UI.Xaml.Navigation;

namespace __APP__
{
    sealed partial class App : Application
    {
        /// <summary>True when running on an Xbox console.</summary>
        public static bool IsXbox =>
            AnalyticsInfo.VersionInfo.DeviceFamily == "Windows.Xbox";

        public App()
        {
            InitializeComponent();
            Suspending += OnSuspending;

            // On Xbox, XAML defaults to "mouse mode": a virtual cursor driven by the
            // left stick that swallows gamepad input. A game must opt out so the
            // Gamepad API inside the WebView receives the stick and buttons directly.
            RequiresPointerMode = ApplicationRequiresPointerMode.WhenRequested;

            UnhandledException += (s, e) =>
            {
                System.Diagnostics.Debug.WriteLine("Unhandled: " + e.Message);
            };
        }

        protected override void OnLaunched(LaunchActivatedEventArgs e)
        {
            if (!IsXbox)
            {
                // A comfortable default window on PC; the player can go full screen with F11.
                ApplicationView.PreferredLaunchViewSize = new Size(1280, 720);
                ApplicationView.PreferredLaunchWindowingMode = ApplicationViewWindowingMode.PreferredLaunchViewSize;
            }

            Frame rootFrame = Window.Current.Content as Frame;

            if (rootFrame == null)
            {
                rootFrame = new Frame();
                rootFrame.NavigationFailed += OnNavigationFailed;
                Window.Current.Content = rootFrame;
            }

            if (e.PrelaunchActivated == false)
            {
                if (rootFrame.Content == null)
                {
                    rootFrame.Navigate(typeof(MainPage), e.Arguments);
                }

                if (IsXbox) ConfigureForXbox();
                else ConfigureForDesktop();

                // The gamepad B button raises BackRequested on Xbox. Left unhandled,
                // the shell closes the app — so swallow it here and let the game
                // handle B itself through the Gamepad API.
                SystemNavigationManager.GetForCurrentView().BackRequested += (s, args) =>
                {
                    args.Handled = true;
                };

                Window.Current.Activate();
            }
        }

        private static void ConfigureForXbox()
        {
            try
            {
                // Draw edge to edge instead of inside the TV-safe inset. The web layer
                // applies its own safe-area padding to the HUD (body.tv in main.css),
                // so the 3D scene fills the screen while text stays clear of overscan.
                ApplicationView.GetForCurrentView()
                    .SetDesiredBoundsMode(ApplicationViewBoundsMode.UseCoreWindow);
            }
            catch
            {
                // Older console firmware: fall back to the default safe-area bounds.
            }
        }

        private static void ConfigureForDesktop()
        {
            try
            {
                ApplicationView.GetForCurrentView().SetPreferredMinSize(new Size(800, 480));
                ApplicationView.GetForCurrentView().Title = "__APP__";

                CoreApplicationViewTitleBar coreTitleBar = CoreApplication.GetCurrentView().TitleBar;
                coreTitleBar.ExtendViewIntoTitleBar = false;

                ApplicationViewTitleBar titleBar = ApplicationView.GetForCurrentView().TitleBar;
                titleBar.BackgroundColor = Windows.UI.Color.FromArgb(255, 12, 9, 18);
                titleBar.ForegroundColor = Windows.UI.Color.FromArgb(255, 232, 226, 244);
                titleBar.InactiveBackgroundColor = Windows.UI.Color.FromArgb(255, 12, 9, 18);
                titleBar.InactiveForegroundColor = Windows.UI.Color.FromArgb(255, 140, 130, 158);
                titleBar.ButtonBackgroundColor = Windows.UI.Color.FromArgb(255, 12, 9, 18);
                titleBar.ButtonForegroundColor = Windows.UI.Color.FromArgb(255, 232, 226, 244);
                titleBar.ButtonHoverBackgroundColor = Windows.UI.Color.FromArgb(255, 38, 28, 54);
                titleBar.ButtonInactiveBackgroundColor = Windows.UI.Color.FromArgb(255, 12, 9, 18);
            }
            catch
            {
                // Window chrome customisation is cosmetic — never let it block launch.
            }
        }

        void OnNavigationFailed(object sender, NavigationFailedEventArgs e)
        {
            throw new Exception("Failed to load Page " + e.SourcePageType.FullName);
        }

        private void OnSuspending(object sender, SuspendingEventArgs e)
        {
            var deferral = e.SuspendingOperation.GetDeferral();
            deferral.Complete();
        }
    }
}
