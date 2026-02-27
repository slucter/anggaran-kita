import { pgTable, text, timestamp, uuid, integer, boolean, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    fullname: text("fullname").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
    templates: many(templates),
    sessions: many(sessions),
}));

export const sessions = pgTable("sessions", {
    id: text("id").primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, {
        fields: [sessions.userId],
        references: [users.id],
    }),
}));

export const templates = pgTable("templates", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }), // Nullable for existing data, but should be enforced later
    name: text("name").notNull(),
    targetMonth: text("target_month"), // Format: YYYY-MM
    isTemplate: boolean("is_template").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const templatesRelations = relations(templates, ({ one, many }) => ({
    user: one(users, {
        fields: [templates.userId],
        references: [users.id],
    }),
    incomes: many(incomes),
    expenseCategories: many(expenseCategories),
}));

export const incomes = pgTable("incomes", {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "cascade" }).notNull(),
    name: text("name").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
});

export const incomesRelations = relations(incomes, ({ one }) => ({
    template: one(templates, {
        fields: [incomes.templateId],
        references: [templates.id],
    }),
}));

export const expenseCategories = pgTable("expense_categories", {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id").references(() => templates.id, { onDelete: "cascade" }).notNull(),
    name: text("name").notNull(),
    order: integer("order").default(0).notNull(),
});

export const expenseCategoriesRelations = relations(expenseCategories, ({ one, many }) => ({
    template: one(templates, {
        fields: [expenseCategories.templateId],
        references: [templates.id],
    }),
    expenseItems: many(expenseItems),
}));

export const expenseItems = pgTable("expense_items", {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id").references(() => expenseCategories.id, { onDelete: "cascade" }).notNull(),
    name: text("name").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    isChecked: boolean("is_checked").default(false).notNull(),
});

export const expenseItemsRelations = relations(expenseItems, ({ one }) => ({
    category: one(expenseCategories, {
        fields: [expenseItems.categoryId],
        references: [expenseCategories.id],
    }),
}));

