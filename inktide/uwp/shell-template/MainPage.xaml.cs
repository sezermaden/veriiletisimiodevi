using System;
using System.IO;
using Microsoft.Web.WebView2.Core;
using Windows.ApplicationModel;
using Windows.ApplicationModel.Core;
using Windows.Storage;
using Windows.Storage.Streams;
using Windows.System.Profile;
using Windows.UI.ViewManagement;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;

namespace __APP__
{
    /// <summary>
    /// Hosts the game inside a WebView2. The game itself lives in the packaged
    /// "www" folder and is served over a virtual host so that ES modules,
    /// WebGL2 and the Gamepad API all behave exactly as they do in a browser.
    /// </summary>
    public sealed partial class MainPage : Page
    {
        private const string VirtualHost = "__HOST__";
        private const string StartPage = "https://" + VirtualHost + "/index.html";

        private bool _fallbackInstalled;

        public MainPage()
        {
            InitializeComponent();
            Loaded += OnLoaded;
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            try
            {
                StatusText.Text = "Preparing the renderer…";
                await GameView.EnsureCoreWebView2Async();

                CoreWebView2 core = GameView.CoreWebView2;

                // Serve the packaged www folder as https://__HOST__/
                string root = Path.Combine(Package.Current.InstalledLocation.Path, "www");
                core.SetVirtualHostNameToFolderMapping(
                    VirtualHost, root, CoreWebView2HostResourceAccessKind.Allow);

                // Make it feel like a game window rather than a browser.
                core.Settings.AreDefaultContextMenusEnabled = false;
                core.Settings.AreBrowserAcceleratorKeysEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.IsZoomControlEnabled = false;
                core.Settings.IsSwipeNavigationEnabled = false;
                core.Settings.IsPasswordAutosaveEnabled = false;
                core.Settings.IsGeneralAutofillEnabled = false;
#if DEBUG
                core.Settings.AreDevToolsEnabled = true;
#else
                core.Settings.AreDevToolsEnabled = false;
#endif

                core.WebMessageReceived += OnWebMessage;
                core.NavigationCompleted += OnNavigationCompleted;
                core.NewWindowRequested += (s, args) => { args.Handled = true; };

                // Tell the game which device it is running on, before any of its own
                // script runs. On Xbox it switches to a 10-foot layout: TV-safe
                // padding, larger text, no mouse cursor.
                string deviceFamily = AnalyticsInfo.VersionInfo.DeviceFamily;
                await core.AddScriptToExecuteOnDocumentCreatedAsync(
                    "window.GAME_HOST = { shell: 'uwp', deviceFamily: '" +
                    deviceFamily.Replace("'", "") + "' };");

                GameView.Source = new Uri(StartPage);
            }
            catch (Exception ex)
            {
                ShowFailure(
                    "__APP__ needs the Microsoft Edge WebView2 Runtime, which does not " +
                    "appear to be installed on this PC.\n\n" + ex.Message);
            }
        }

        private void OnNavigationCompleted(CoreWebView2 sender, CoreWebView2NavigationCompletedEventArgs args)
        {
            if (args.IsSuccess)
            {
                StatusPanel.Visibility = Visibility.Collapsed;
                return;
            }

            // Virtual host mapping can be blocked by the app container on some
            // configurations. Serve the packaged files ourselves instead.
            if (!_fallbackInstalled)
            {
                _fallbackInstalled = true;
                StatusText.Text = "Loading the game…";
                sender.AddWebResourceRequestedFilter("https://" + VirtualHost + "/*",
                    CoreWebView2WebResourceContext.All);
                sender.WebResourceRequested += OnWebResourceRequested;
                GameView.Source = new Uri(StartPage + "?r=1");
                return;
            }

            ShowFailure("The game files could not be loaded from the app package.\n\n" +
                        "Navigation error: " + args.WebErrorStatus);
        }

        /// <summary>Fallback content provider: reads the packaged www folder directly.</summary>
        private async void OnWebResourceRequested(CoreWebView2 sender, CoreWebView2WebResourceRequestedEventArgs args)
        {
            // NOTE: the UWP/WinRT projection returns Windows.Foundation.Deferral here,
            // not CoreWebView2Deferral (that type is WPF/WinForms/WinUI 3 only).
            Windows.Foundation.Deferral deferral = args.GetDeferral();
            try
            {
                var uri = new Uri(args.Request.Uri);
                string rel = Uri.UnescapeDataString(uri.AbsolutePath).TrimStart('/');
                if (rel.Length == 0) rel = "index.html";
                rel = rel.Replace('/', '\\');

                StorageFolder www = await Package.Current.InstalledLocation.GetFolderAsync("www");
                StorageFile file = await www.GetFileAsync(rel);
                IRandomAccessStream stream = await file.OpenReadAsync();

                args.Response = sender.Environment.CreateWebResourceResponse(
                    stream, 200, "OK",
                    "Content-Type: " + MimeFor(rel) + "\r\nCache-Control: no-cache");
            }
            catch
            {
                args.Response = sender.Environment.CreateWebResourceResponse(
                    null, 404, "Not Found", "Content-Type: text/plain");
            }
            finally
            {
                deferral.Complete();
            }
        }

        private static string MimeFor(string path)
        {
            string ext = Path.GetExtension(path).ToLowerInvariant();
            switch (ext)
            {
                case ".html": return "text/html; charset=utf-8";
                case ".js": return "text/javascript; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".json": return "application/json; charset=utf-8";
                case ".png": return "image/png";
                case ".jpg":
                case ".jpeg": return "image/jpeg";
                case ".svg": return "image/svg+xml";
                case ".ico": return "image/x-icon";
                case ".wasm": return "application/wasm";
                default: return "application/octet-stream";
            }
        }

        private void ShowFailure(string message)
        {
            StatusPanel.Visibility = Visibility.Visible;
            StatusText.Text = message;
            RuntimeLink.Visibility = Visibility.Visible;
        }

        private void OnWebMessage(CoreWebView2 sender, CoreWebView2WebMessageReceivedEventArgs args)
        {
            string message;
            try { message = args.TryGetWebMessageAsString(); }
            catch { return; }

            switch (message)
            {
                case "quit":
                    CoreApplication.Exit();
                    break;

                case "fullscreen":
                    ToggleFullScreen();
                    break;
            }
        }

        private static void ToggleFullScreen()
        {
            ApplicationView view = ApplicationView.GetForCurrentView();
            if (view.IsFullScreenMode) view.ExitFullScreenMode();
            else view.TryEnterFullScreenMode();
        }
    }
}
