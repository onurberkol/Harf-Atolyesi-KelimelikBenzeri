import UIKit
import WebKit

@main
final class HarfAtolyesiApp: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        configurationForConnecting session: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        let configuration = UISceneConfiguration(name: nil, sessionRole: session.role)
        configuration.delegateClass = GameScene.self
        return configuration
    }
}

final class GameScene: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = GameViewController()
        window.makeKeyAndVisible()
        self.window = window
    }
}

final class GameViewController: UIViewController {
    private let game = WKWebView()

    override func viewDidLoad() {
        super.viewDidLoad()
        let cream = UIColor(red: 252/255, green: 241/255, blue: 221/255, alpha: 1)
        view.backgroundColor = cream
        game.backgroundColor = cream
        game.isOpaque = false
        game.scrollView.bounces = false
        game.scrollView.contentInsetAdjustmentBehavior = .never
        game.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(game)
        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            game.topAnchor.constraint(equalTo: safe.topAnchor),
            game.bottomAnchor.constraint(equalTo: safe.bottomAnchor),
            game.leadingAnchor.constraint(equalTo: safe.leadingAnchor),
            game.trailingAnchor.constraint(equalTo: safe.trailingAnchor)
        ])
        if let address = Bundle.main.url(forResource: "game-url", withExtension: "txt"),
           let value = try? String(contentsOf: address, encoding: .utf8),
           let remote = URL(string: value.trimmingCharacters(in: .whitespacesAndNewlines)),
           remote.scheme == "https", remote.host != nil {
            game.load(URLRequest(url: remote))
            return
        }
        guard let url = Bundle.main.url(forResource: "index", withExtension: "html") else {
            assertionFailure("The bundled game could not be opened")
            return
        }
        game.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

}
