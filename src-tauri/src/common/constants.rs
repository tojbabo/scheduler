use std::fmt;

/// App-defined categories.
/// Discriminant (= integer value) should match `categories.id` in the DB.
#[repr(i64)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Category {
    Other = 0,
    Family = 1,
    Friends = 2,
    Work = 3,
    Health = 4,
}

impl Category {
    /// All categories in display / id order.
    pub const ALL: [Category; 5] = [
        Self::Other,
        Self::Family,
        Self::Friends,
        Self::Work,
        Self::Health,
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
            0 => Ok(Self::Other),
            1 => Ok(Self::Family),
            2 => Ok(Self::Friends),
            3 => Ok(Self::Work),
            4 => Ok(Self::Health),
            _ => Err(()),
        }
    }
}

impl fmt::Display for Category {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let label = match self {
            Self::Other => "기타",
            Self::Family => "가족",
            Self::Friends => "친구",
            Self::Work => "회사",
            Self::Health => "운동",
        };
        f.write_str(label)
    }
}
