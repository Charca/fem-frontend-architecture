workspace "CommerceOS - v2" "C4 model for CommerceOS, a Shopify-like platform for creating storefronts and selling products online." {
    !identifiers hierarchical

    model {
        user = person "User" "Signs up for CommerceOS to create a store and sell products online."
        customer = person "Customer" "Purchases products from a User's storefront."
        pluginDeveloper = person "Plugin Developer" "Builds third-party plugins and extensions for CommerceOS."

        group "CommerceOS" {
            storefront = softwareSystem "Storefront" "Customer-facing ecommerce frontend."

            admin = softwareSystem "Admin System" "Platform that Users use to manage storefronts." {
                web = container "Admin Web App" "Browser-based interface for managing stores, products, orders, and settings." "React SPA"
                mobile = container "Mobile App" "Mobile interface for managing stores, products, orders, and notifications." "React Native"
                api = container "Core API" "Gateway API used by both the Admin and Storefront systems." "Go/Gin REST API"
                db = container "Core DB" "Stores users, stores, products, orders, customer records, and platform configuration." "Postgres" {
                    tags "Database"
                }
                ordersApi = container "Orders API" "Manages order lifecycle, order status, and fulfillment coordination." "Java Spring"
                ordersDb = container "Orders DB" "Stores order records, order events, and fulfillment state." "Postgres" {
                    tags "Database"
                }
                publicApi = container "Public API" "Plugin API for third-party integrations, plugins, and extensions." "Bun / Hono"
                aiGateway = container "AI Gateway" "Routes AI-assisted commerce workflows to configured LLM providers." "Python / LiteLLM"
            }
        }

        payments = softwareSystem "Payments System" "Third-party system that manages payment processing, payouts, and refunds." "Stripe"
        fulfillment = softwareSystem "Order Fulfillment System" "Third-party system that manages shipping, shelving, inventory handling, and fulfillment."
        llmProvider = softwareSystem "LLM Provider" "Third-party large language model provider, such as OpenAI, Anthropic, or Google."

        user -> admin "Manages storefronts, products, orders, shipping settings, and payments"
        customer -> storefront "Browses products and checks out"
        pluginDeveloper -> admin "Builds third-party plugins and extensions"
        admin -> storefront "Publishes storefront configuration and catalog changes"
        storefront -> admin.api "Reads catalog data and creates carts/orders" "HTTPS/JSON"
        admin -> payments "Configures payment accounts and receives payment status"
        admin -> fulfillment "Sends fulfillment requests and receives shipment status"
        admin -> llmProvider "Uses AI models for assisted commerce workflows"
        payments -> admin.api "Sends payment events" "Webhooks"
        fulfillment -> admin.api "Sends fulfillment and shipment events" "Webhooks"

        user -> admin.web "Uses"
        user -> admin.mobile "Uses on mobile"
        pluginDeveloper -> admin.publicApi "Builds plugins and extensions" "HTTPS/JSON"
        admin.web -> admin.api "Manages commerce resources" "HTTPS/JSON"
        admin.mobile -> admin.api "Manages commerce resources" "HTTPS/JSON"
        admin.publicApi -> admin.api "Accesses commerce capabilities" "HTTPS/JSON"
        admin.publicApi -> admin.ordersApi "Accesses order capabilities" "HTTPS/JSON"
        admin.api -> admin.db "Reads from and writes to" "SQL"
        admin.api -> admin.ordersApi "Delegates order operations" "HTTPS/JSON"
        admin.ordersApi -> admin.ordersDb "Reads from and writes to" "SQL"
        admin.api -> payments "Creates payment sessions and refunds" "HTTPS/JSON"
        admin.api -> fulfillment "Creates fulfillment requests" "HTTPS/JSON"
        admin.api -> admin.aiGateway "Requests AI-assisted operations" "HTTPS/JSON"
        admin.aiGateway -> llmProvider "Routes prompts and model requests" "HTTPS/JSON"
    }

    views {
        systemContext admin "SystemContext" {
            include user
            include customer
            include pluginDeveloper
            include storefront
            include admin
            include payments
            include fulfillment
            include llmProvider
            exclude "storefront -> admin"
            exclude "payments -> admin"
            exclude "fulfillment -> admin"
            autolayout tb
        }

        container admin "AdminContainers" {
            include user
            include customer
            include pluginDeveloper
            include storefront
            include admin.web
            include admin.mobile
            include admin.api
            include admin.db
            include admin.ordersApi
            include admin.ordersDb
            include admin.publicApi
            include admin.aiGateway
            include payments
            include fulfillment
            include llmProvider
            exclude "payments -> admin.api"
            exclude "fulfillment -> admin.api"
            autolayout lr 450 450
        }

        styles {
            element "Person" {
                shape person
                background #0f766e
                color #ffffff
            }

            element "Software System" {
                background #1f2937
                color #ffffff
            }

            element "Container" {
                background #2563eb
                color #ffffff
            }

            element "Database" {
                shape cylinder
                background #7c3aed
                color #ffffff
            }

            element "Group" {
                color #94a3b8
                stroke #334155
                strokeWidth 2
                border solid
            }

            element "Boundary:SoftwareSystem" {
                color #94a3b8
                stroke #334155
                strokeWidth 2
                border solid
            }
        }
    }

    configuration {
        properties {
            "structurizr.introduction" "false"
        }
    }
}
