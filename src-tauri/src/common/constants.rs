use std::fmt;

/// App-defined categories.
/// Discriminant (= integer value) should match `categories.id` in the DB.
#[repr(i64)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Category {
    other = 0,
    family = 1,
    friends = 2,
    work = 3,
    health = 4,
}

impl Category {
    /// All categories in display / id order.
    pub const ALL: [Category; 5] = [
        Self::other,
        Self::family,
        Self::friends,
        Self::work,
        Self::health,
    ];

    /// DB `categories.id`.
    pub const fn id(self) -> i64 {
        self as i64
    }
}

impl TryFrom<i64> for Category {
    type Error = ();

    fn try_from(value: i64) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Self::other),
            1 => Ok(Self::family),
            2 => Ok(Self::friends),
            3 => Ok(Self::work),
            4 => Ok(Self::health),
            _ => Err(()),
        }
    }
}

impl fmt::Display for Category {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let label = match self {
            Self::other => "기타",
            Self::family => "가족",
            Self::friends => "친구",
            Self::work => "회사",
            Self::health => "운동",
        };
        f.write_str(label)
    }
}
